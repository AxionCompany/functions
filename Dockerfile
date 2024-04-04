FROM denoland/deno:alpine

WORKDIR /app

USER deno

COPY --chown=deno:deno . .

CMD ["task", "start"]
