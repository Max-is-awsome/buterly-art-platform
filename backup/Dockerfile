FROM postgres:18-alpine
RUN apk add --no-cache python3 py3-boto3 su-exec
COPY backup.py /backup.py
ENTRYPOINT ["python3", "/backup.py"]
