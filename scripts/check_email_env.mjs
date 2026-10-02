import { runRemote } from './vps_exec.mjs';

const res = runRemote(`bash << 'EOF'
if [ -f /home/ncms/VetRx/.env ]; then
  echo "=== .env Keys Present ==="
  grep -o "^[A-Z_0-9]*" /home/ncms/VetRx/.env | sort -u
  echo "=== Email-related Keys and Non-Secret Values ==="
  grep -iE "(mail|smtp|sendgrid|resend|postmark|brevo|from)" /home/ncms/VetRx/.env | while read line; do
    key=$(echo "$line" | cut -d= -f1)
    val=$(echo "$line" | cut -d= -f2-)
    if echo "$key" | grep -iE "(pass|secret|key|token)"; then
      echo "$key=[REDACTED-PRESENT, length \${#val}]"
    else
      echo "$key=$val"
    fi
  done
  echo "=== Container Environment Inspection via Docker Inspect ==="
  docker inspect vetrx-backend-prod --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(EMAIL_|BREVO_)' | while read line; do
    k=$(echo "$line" | cut -d= -f1)
    v=$(echo "$line" | cut -d= -f2-)
    if [ "$k" = "BREVO_API_KEY" ]; then
      if [ -n "$v" ]; then echo "$k=present (length \${#v})"; else echo "$k=missing"; fi
    else
      echo "$k=$v"
    fi
  done
  echo "=== Container Started At ==="
  docker inspect vetrx-backend-prod --format '{{.State.StartedAt}}'
else
  echo ".env NOT FOUND"
fi
EOF
`);

console.log(res);
