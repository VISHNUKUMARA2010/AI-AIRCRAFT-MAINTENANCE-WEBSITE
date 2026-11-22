"""
Simple FastAPI backend for the aircraft maintenance platform.

This file exposes three lightweight endpoints:
1. Health check
2. Aircraft analytics from an upload Excel file
3. Maintenance prediction from analytics output
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
import logging
from typing import Any

# Ensure backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import boto3
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.aircraft_maintenance.bedrock_maintenance_analyzer import AircraftMaintenanceAnalyzer
from src.aircraft_maintenance.engineering_analytics import AircraftEngineeringAnalytics
from src.aircraft_maintenance.rule_based_analyzer import RuleBasedMaintenanceAnalyzer
from src.aircraft_maintenance.airworthiness_report_parser import (
    is_airworthiness_report,
    parse_airworthiness_excel,
    parse_airworthiness_pdf,
    generate_airworthiness_decision,
)

logger = logging.getLogger("aircraft_maintenance_api")
logging.basicConfig(level=logging.INFO)

# Load environment variables from .env file
load_dotenv()


app = FastAPI(
    title="Aircraft Maintenance API",
    version="1.0.0",
    description="Simple API for aircraft engineering analytics & maintenance reporting",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root() -> dict[str, str]:
    """Simple root endpoint so the frontend can comfirm the backend is live."""
    return {"status": "ok", "service": "aircraft-maintenance-api", "message": "Backend is running"}


@app.get("/testing/health")
def health_check() -> dict[str, str]:
    """Simple heath check endpoint for smoke testing."""
    return {"status": "ok", "service": "aircraft-maintenance-api"}


@app.get("/aircraft/sample")
def load_sample_analytics(aircraft_id: str | None = None) -> dict[str, Any]:
    """Load pre-packaged sample flight telemetry with optional aircraft ID selection."""
    sample_path = BASE_DIR / "data" / "aircraft_maintenance_intelligence_dataset.xlsx"
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail="Sample dataset not found.")

    try:
        analytics = AircraftEngineeringAnalytics(
            excel_path=str(sample_path),
            sheet_name=0,
        )
        analytics.load_dataset()
        aircraft_list = analytics.list_aircraft()
        if not aircraft_list:
            raise ValueError("No aircraft found in sample dataset.")

        selected_aircraft = aircraft_id if aircraft_id and aircraft_id in aircraft_list else aircraft_list[0]
        summary = analytics.generate_summary(
            aircraft_id=selected_aircraft,
            history_window=10,
        )
        return {
            "message": "Sample analytics generated successfully",
            "aircraft_id": selected_aircraft,
            "available_aircraft": aircraft_list,
            "summary": summary.to_dict(),
        }
    except Exception as exc:
        logger.exception("Sample analytics failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/aircraft/analytics")
async def aircraft_analytics(
    excel_file: UploadFile = File(...),
    aircraft_id: str | None = None,
) -> dict[str, Any]:
    """
    Generate engineering analytics from an uploaded Excel or status report file.
    Supports standard flight telemetry and Google AI generated airworthiness reports.
    """
    if not excel_file.filename:
        raise HTTPException(status_code=400, detail="Please upload a valid file.")

    allowed_extensions = (".xlsx", ".xls", ".pdf", ".csv")
    if not excel_file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid Excel file (.xlsx, .xls) or PDF report.",
        )

    temp_path: str | None = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=Path(excel_file.filename).suffix,
        ) as temp_file:
            content = await excel_file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        # Check if the uploaded file is an Airworthiness Status Report (e.g., from Google AI / Cessna report)
        if is_airworthiness_report(temp_path, excel_file.filename):
            logger.info("Airworthiness Status Report detected: %s", excel_file.filename)
            if excel_file.filename.lower().endswith(".pdf"):
                return parse_airworthiness_pdf(temp_path, excel_file.filename)
            return parse_airworthiness_excel(temp_path, excel_file.filename)

        analytics = AircraftEngineeringAnalytics(
            excel_path=temp_path,
            sheet_name=0,
        )
        analytics.load_dataset()

        aircraft_list = analytics.list_aircraft()
        if not aircraft_list:
            raise ValueError("No aircraft data found in the uploaded file.")

        selected_aircraft = aircraft_id if aircraft_id and aircraft_id in aircraft_list else aircraft_list[0]
        summary = analytics.generate_summary(
            aircraft_id=selected_aircraft,
            history_window=10,
        )
        return {
            "message": "Analytics generated successfully",
            "aircraft_id": selected_aircraft,
            "available_aircraft": aircraft_list,
            "summary": summary.to_dict(),
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/aircraft/upload-manual")
async def upload_manual(
    manual_file: UploadFile = File(...),
) -> dict[str, Any]:
    """Upload a custom aircraft maintenance manual PDF (.pdf)."""
    if not manual_file.filename:
        raise HTTPException(status_code=400, detail="Please select a PDF file.")

    if not manual_file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid PDF file (.pdf).",
        )

    uploads_dir = BASE_DIR / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(manual_file.filename).name
    save_path = uploads_dir / safe_name
    content = await manual_file.read()
    save_path.write_bytes(content)

    is_report = False
    report_analytics = None
    try:
        if is_airworthiness_report(save_path, manual_file.filename):
            is_report = True
            report_analytics = parse_airworthiness_pdf(save_path, manual_file.filename)
            logger.info("Uploaded PDF is an Airworthiness Status Report: %s", safe_name)
    except Exception as parse_err:
        logger.warning("PDF airworthiness check error: %s", parse_err)

    return {
        "message": "Maintenance manual uploaded successfully",
        "filename": safe_name,
        "path": str(save_path),
        "size_bytes": len(content),
        "is_airworthiness_report": is_report,
        "analytics": report_analytics,
    }


@app.post("/aircraft/maintenance-prediction")
def maintenance_prediction(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Generate a maintenance prediction report from the analytics output.
    
    The request body can be the fully response from the analytics endpoint,
    and this function will extract the analytics payload automatically.
    """
    if not isinstance(payload, dict) or not payload:
        raise HTTPException(status_code=400, detail="Please send the analytics output from the second API.")

    if isinstance(payload.get("summary"), dict):
        engineering_json = payload["summary"]
    elif isinstance(payload.get("engineering_json"), dict):
        engineering_json = payload["engineering_json"]
    else:
        engineering_json = payload

    if not isinstance(engineering_json, dict) or not engineering_json:
        raise HTTPException(status_code=400, detail="The analytics payload is empty or invalid.")

    base_dir = Path(__file__).resolve().parent
    default_manual = base_dir / "data" / "AeroTech_ATX200_Maintenance_Manual.pdf"

    # Check if a custom manual was specified
    custom_manual_name = payload.get("manual_filename")
    if custom_manual_name:
        candidate_path = base_dir / "data" / "uploads" / Path(custom_manual_name).name
        if candidate_path.exists():
            manual_pdf_path = str(candidate_path)
            manual_display_name = candidate_path.name
        else:
            manual_pdf_path = str(default_manual)
            manual_display_name = default_manual.name
    else:
        manual_pdf_path = str(default_manual)
        manual_display_name = default_manual.name

    # Check if this payload represents an Airworthiness Status Report (e.g., from Google AI / Cessna)
    is_airworthiness = (
        payload.get("is_airworthiness_report")
        or (isinstance(engineering_json, dict) and engineering_json.get("is_airworthiness_report"))
        or (isinstance(payload.get("summary"), dict) and payload["summary"].get("is_airworthiness_report"))
    )

    if is_airworthiness:
        logger.info("Generating airworthiness decision and compliance benchmarks for status report")
        return generate_airworthiness_decision(payload, manual_display_name)

    aws_access_key = (os.getenv("AWS_ACCESS_KEY_ID") or "").strip()
    aws_secret_key = (os.getenv("AWS_SECRET_ACCESS_KEY") or "").strip()
    is_placeholder_key = not aws_access_key or "your" in aws_access_key.lower() or aws_access_key == "YOUR_ACCESS_KEY"
    force_rule_engine = (
        os.getenv("USE_RULE_ENGINE", "false").lower() in ("true", "1", "yes")
        or is_placeholder_key
    )

    if force_rule_engine:
        logger.info("Directly using RuleBasedMaintenanceAnalyzer (offline / zero-cost mode)")
        pdf_arg = manual_pdf_path if Path(manual_pdf_path).exists() else None
        analyzer = RuleBasedMaintenanceAnalyzer(manual_pdf_path=pdf_arg)
        report = analyzer.analyze(engineering_json)
        report["manual_source"] = manual_display_name
        return {"success": True, "report": report}

    if not Path(manual_pdf_path).exists():
        logger.warning(
            "Maintenance manual PDF not found at %s. Falling back to Rule-Based Maintenance Engine.",
            manual_pdf_path,
        )
        fallback_analyzer = RuleBasedMaintenanceAnalyzer()
        report = fallback_analyzer.analyze(engineering_json)
        return {"success": True, "report": report}

    try:
        aws_region = os.getenv("AWS_REGION", "us-east-1")
        aws_session_token = os.getenv("AWS_SESSION_TOKEN")
        bedrock_model_id = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-pro-v1:0")

        boto3_kwargs = {
            "service_name": "bedrock-runtime",
            "region_name": aws_region,
        }

        # Only add explicit credentials if they are provided in .env
        # Otherwise, boto3 will fall back to default credential providers (e.g., ~/.aws/credentials)
        if not is_placeholder_key and aws_secret_key and "your" not in aws_secret_key.lower():
            boto3_kwargs["aws_access_key_id"] = aws_access_key
            boto3_kwargs["aws_secret_access_key"] = aws_secret_key
            if aws_session_token:
                boto3_kwargs["aws_session_token"] = aws_session_token

        bedrock_client = boto3.client(**boto3_kwargs)

        analyzer = AircraftMaintenanceAnalyzer(
            bedrock_client=bedrock_client,
            model_id=bedrock_model_id,
            manual_pdf_path=manual_pdf_path,
            temperature=0.2,
            max_tokens=2_000,
        )

        report = analyzer.analyze(engineering_json)
        report["manual_source"] = manual_display_name
        return {"success": True, "report": report}

    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.warning("Bedrock invocation failed: %s. Falling back to Rule-Based Maintenance Engine.", exc)
        try:
            pdf_arg = manual_pdf_path if Path(manual_pdf_path).exists() else None
            fallback_analyzer = RuleBasedMaintenanceAnalyzer(manual_pdf_path=pdf_arg)
            report = fallback_analyzer.analyze(engineering_json)
            report["confidence"]["rationale"] = (
                "Generated using the Aero ATX200 Maintenance Manual Engine (Free / offline Mode)."
            )
            return {"success": True, "report": report}
        except Exception as fallback_exc:
            raise HTTPException(
                status_code=500,
                detail=f"Maintenance prediction failed: {exc} (Fallback failed: {fallback_exc})",
            ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)