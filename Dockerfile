# Dockerfile
FROM python:3.9

WORKDIR /code

# Copy back-end dependencies
COPY ./backend/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Create HF-compliant writable paths & redirect cache drivers
RUN mkdir -p /tmp/chromadb /tmp/huggingface
ENV TRANSFORMERS_CACHE=/tmp/huggingface
ENV HF_HOME=/tmp/huggingface
ENV CHROMA_DB_PATH=/tmp/chromadb

# Copy all back-end code
COPY ./backend /code/backend

# Expose required Hugging Face Space port
EXPOSE 7860

# CMD to target the app object inside the backend folder module
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
