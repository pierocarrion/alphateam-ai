#!/usr/bin/env python3
"""Submit a Cloud Build job via the REST API, bypassing gcloud builds submit bucket checks."""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import yaml

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
GCS_SOURCE = os.environ.get("GCS_SOURCE", "")
VERSION = os.environ.get("VERSION", "latest")
CONFIG = os.environ.get("CB_CONFIG", "cloudbuild.yaml")
TOKEN = os.environ["GCP_ACCESS_TOKEN"]

with open(CONFIG) as f:
    config = yaml.safe_load(f)

steps = config.get("steps", [])
options = config.get("options", {})
substitutions = config.get("substitutions", {})
images = config.get("images", [])
available_secrets = config.get("availableSecrets")

substitutions["_VERSION"] = VERSION

build_body = {
    "steps": steps,
    "options": options,
    "substitutions": substitutions,
}

if images:
    build_body["images"] = images

if available_secrets:
    build_body["availableSecrets"] = available_secrets

if GCS_SOURCE:
    bucket, obj = GCS_SOURCE.replace("gs://", "").split("/", 1)
    build_body["source"] = {
        "storageSource": {
            "bucket": bucket,
            "object": obj,
        }
    }

url = f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}/builds"
data = json.dumps(build_body).encode()
req = urllib.request.Request(url, data=data, method="POST")
req.add_header("Authorization", f"Bearer {TOKEN}")
req.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"ERROR creating build: {e.code} {body}", file=sys.stderr)
    sys.exit(1)

build_id = result.get("id") or result.get("metadata", {}).get("build", {}).get("id")
if not build_id:
    print(f"Could not find build ID in response: {json.dumps(result)[:500]}", file=sys.stderr)
    sys.exit(1)

build_url = result.get("logUrl", "") or (
    f"https://console.cloud.google.com/cloud-build/builds/{build_id}?project={PROJECT_ID}"
)
print(f"Build created: {build_id}")
print(f"Console logs: {build_url}")

url = f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}/builds/{build_id}"
headers = {"Authorization": f"Bearer {TOKEN}"}

deadline = time.time() + 1800
while time.time() < deadline:
    time.sleep(15)
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            status_data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Poll error: {e.code}", file=sys.stderr)
        continue
    status = status_data.get("status", "UNKNOWN")
    print(f"Build status: {status}")
    if status in ("SUCCESS", "FAILURE", "TIMEOUT", "CANCELLED"):
        if status == "SUCCESS":
            print("Build succeeded!")
            sys.exit(0)
        else:
            print("", file=sys.stderr)
            print(f"Build {status}.", file=sys.stderr)
            print(f"Console logs: {build_url}", file=sys.stderr)
            print("", file=sys.stderr)
            error = status_data.get("error", {})
            if error:
                print(f"=== Build error ===", file=sys.stderr)
                print(json.dumps(error, indent=2), file=sys.stderr)
                print("", file=sys.stderr)
            print("=== Build steps ===", file=sys.stderr)
            for i, step in enumerate(status_data.get("steps", [])):
                step_status = step.get("status", "UNKNOWN")
                timing = step.get("timing", {})
                started = timing.get("startTime", "n/a")
                finished = timing.get("endTime", "n/a")
                print(f"  Step {i}: {step_status} (start={started}, end={finished})", file=sys.stderr)
            print("", file=sys.stderr)
            print("=== Build logs (Cloud Logging) ===", file=sys.stderr)
            try:
                log_filter = (
                    f'resource.type="build" AND '
                    f'resource.labels.build_id="{build_id}"'
                )
                log_body = json.dumps({
                    "resourceNames": [f"projects/{PROJECT_ID}"],
                    "filter": log_filter,
                    "orderBy": "timestamp asc",
                    "pageSize": 500,
                }).encode()
                log_api_url = "https://logging.googleapis.com/v2/entries:list"
                log_req = urllib.request.Request(log_api_url, data=log_body, method="POST", headers=headers)
                log_req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(log_req) as log_resp:
                    log_data = json.loads(log_resp.read())
                entries = log_data.get("entries", [])
                if not entries:
                    print("(No log entries found in Cloud Logging for this build)", file=sys.stderr)
                for entry in entries:
                    payload = entry.get("textPayload")
                    if payload is None:
                        payload = json.dumps(entry.get("jsonPayload", entry))
                    print(payload, file=sys.stderr)
            except Exception as log_err:
                print(f"(Could not fetch Cloud Logging entries: {log_err})", file=sys.stderr)
                print(f"View logs manually at: {build_url}", file=sys.stderr)
            sys.exit(1)

print("Build timed out waiting for completion", file=sys.stderr)
sys.exit(1)
