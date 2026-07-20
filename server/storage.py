from functools import lru_cache

import boto3

from server.config import settings


@lru_cache(maxsize=1)
def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name=settings.S3_REGION,
    )


def upload_bytes(key: str, data: bytes, content_type: str = "application/pdf") -> None:
    get_s3_client().put_object(Bucket=settings.S3_BUCKET_NAME, Key=key, Body=data, ContentType=content_type)


def delete_object(key: str) -> None:
    get_s3_client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
