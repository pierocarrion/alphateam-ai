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

substitutions["_VERSION"] = VERSION

build_body = {
    "steps": steps,
    "options": options,
    "substitutions": substitutions,
}

if images:
    build_body["images"] = images

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

print(f"API response keys: {list(result.keys())}")
build_id = result.get("id") or result.get("metadata", {}).get("build", {}).get("id")
if not build_id:
    print(f"Could not find build ID in response: {json.dumps(result)[:500]}", file=sys.stderr)
    sys.exit(1)

build_url = result.get("logUrl", "")
print(f"Build created: {build_id}")
print(f"Logs: {build_url}")

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
            results = status_data.get("results", {})
            print(f"Build {status}. Results: {json.dumps(results)}", file=sys.stderr)
            sys.exit(1)

print("Build timed out waiting for completion", file=sys.stderr)
sys.exit(1)
