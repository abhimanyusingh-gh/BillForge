FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV HF_HOME=/models
ENV TRANSFORMERS_CACHE=/models
ENV PYTORCH_ENABLE_MPS_FALLBACK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  git-lfs \
  libgl1 \
  libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

RUN git lfs install

COPY deepseek-ocr/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r /app/requirements.txt

COPY deepseek-ocr/server.py /app/server.py
COPY deepseek-ocr/app /app/app

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
