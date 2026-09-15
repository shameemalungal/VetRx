#!/usr/bin/env bash
set -e
docker exec -i vetrx-postgres-prod psql -U vetrx -d vetrx "$@"
