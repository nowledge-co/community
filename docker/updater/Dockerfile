# nowledgelabs/mem-updater — the auto-update sidecar for the headless Mem
# deployment. Receives bearer-authed calls from the Mem backend over the
# compose-internal docker network to:
#
#   - pull new Mem images on a schedule (no downtime)
#   - apply a new image on a human-clicked button (~30 s downtime)
#   - take a volume-level snapshot before recreate, with disk guardrails
#
# Runs as root inside the container — required for docker.sock and for
# tarring host bind mounts owned by UID 10001. The container is not
# network-exposed outside the compose network; the mem container reaches
# it as http://updater:8080.
#
# Image is published per release alongside docker.io/nowledgelabs/mem so
# that the updater image moves with the Mem image when the contract
# changes. Operators bump it via `./nmemctl auto-update upgrade`.

FROM alpine:3.20

# - docker-cli + docker-cli-compose: pull, stop, recreate via compose
# - socat: dispatch one HTTP request per script invocation — much cleaner
#   than busybox httpd CGI for our pattern (one script, four routes)
# - tini: clean SIGTERM forwarding so `docker compose stop updater` exits
#   fast (don't leave a `docker pull` orphaned in the background)
# - jq: structured JSON responses without hand-rolling escapes
# - coreutils: GNU df (busybox df lacks --output=avail) and GNU date
RUN apk add --no-cache \
      docker-cli \
      docker-cli-compose \
      socat \
      tini \
      jq \
      coreutils \
    && mkdir -p /opt/updater

COPY server.sh /opt/updater/server.sh
COPY scheduler.sh /opt/updater/scheduler.sh
COPY entrypoint.sh /opt/updater/entrypoint.sh

RUN chmod 0755 /opt/updater/server.sh \
              /opt/updater/scheduler.sh \
              /opt/updater/entrypoint.sh

WORKDIR /opt/updater

EXPOSE 8080

# tini -g forwards signals to the whole process group: socat, the pull
# scheduler, and any docker child still running on shutdown.
ENTRYPOINT ["/sbin/tini", "-g", "--", "/opt/updater/entrypoint.sh"]
