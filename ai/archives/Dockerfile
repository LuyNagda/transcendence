FROM ubuntu:latest

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libsdl2-dev \
    libsdl2-image-dev \
    libsdl2-mixer-dev \
    libsdl2-ttf-dev \
    alsa-utils \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV XDG_RUNTIME_DIR=/tmp

# Copy specific project files
# COPY ./app/main.py /app/main.py
# COPY ./app/ai.py /app/ai.py
# COPY ./app/game.py /app/game.py
COPY requirements.txt /app/requirements.txt
WORKDIR /app
# RUN mkdir Saved_AI
# COPY ./Saved_AI/perfect /app/Saved_AI/bestAI

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Run the game
CMD ["python", "main.py", "play"]