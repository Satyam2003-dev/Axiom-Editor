#!/bin/bash

# Exit on error
set -e

# Check platform
platform=$(uname)

if [[ "$platform" == "Darwin" ]]; then
    echo "Running on macOS. Note that the AppImage created will only work on Linux systems."
    if ! command -v docker &> /dev/null; then
        echo "Docker Desktop for Mac is not installed. Please install it from https://www.docker.com/products/docker-desktop"
        exit 1
    fi
elif [[ "$platform" == "Linux" ]]; then
    echo "Running on Linux. Proceeding with AppImage creation..."
else
    echo "This script is intended to run on macOS or Linux. Current platform: $platform"
    exit 1
fi

# Enable BuildKit
export DOCKER_BUILDKIT=1

BUILD_IMAGE_NAME="axiom-appimage-builder"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Check and install Buildx if needed
if ! docker buildx version >/dev/null 2>&1; then
    echo "Installing Docker Buildx..."
    mkdir -p ~/.docker/cli-plugins/
    curl -SL https://github.com/docker/buildx/releases/download/v0.13.1/buildx-v0.13.1.linux-amd64 -o ~/.docker/cli-plugins/docker-buildx
    chmod +x ~/.docker/cli-plugins/docker-buildx
fi

# Download appimagetool if not present
if [ ! -f "appimagetool" ]; then
    echo "Downloading appimagetool..."
    wget -O appimagetool "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x appimagetool
fi

# Delete any existing AppImage to avoid bloating the build
rm -f Axiom-x86_64.AppImage

# Create build Dockerfile
echo "Creating build Dockerfile..."
cat > Dockerfile.build << 'EOF'
# syntax=docker/dockerfile:1
FROM ubuntu:20.04

# Install required dependencies
RUN apt-get update && apt-get install -y \
    libfuse2 \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libdrm2 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
EOF

# Create .dockerignore file
echo "Creating .dockerignore file..."
cat > .dockerignore << EOF
Dockerfile.build
.dockerignore
.git
.gitignore
.DS_Store
*~
*.swp
*.swo
*.tmp
*.bak
*.log
*.err
node_modules/
venv/
*.egg-info/
*.tox/
dist/
EOF

# Build Docker image without cache
echo "Building Docker image (no cache)..."
docker build --no-cache -t "$BUILD_IMAGE_NAME" -f Dockerfile.build .

# Create AppImage using local appimagetool
echo "Creating AppImage..."
docker run --rm --privileged -v "$(pwd):/app" "$BUILD_IMAGE_NAME" bash -c '
cd /app && \
rm -rf AxiomApp.AppDir && \
mkdir -p AxiomApp.AppDir/usr/bin AxiomApp.AppDir/usr/lib AxiomApp.AppDir/usr/share/applications && \
find . -maxdepth 1 ! -name AxiomApp.AppDir ! -name "." ! -name ".." -exec cp -r {} AxiomApp.AppDir/usr/bin/ \; && \
cp axiom.png AxiomApp.AppDir/ && \
echo "[Desktop Entry]" > AxiomApp.AppDir/axiom.desktop && \
echo "Name=Axiom" >> AxiomApp.AppDir/axiom.desktop && \
echo "Comment=Open source AI code editor." >> AxiomApp.AppDir/axiom.desktop && \
echo "GenericName=Text Editor" >> AxiomApp.AppDir/axiom.desktop && \
echo "Exec=axiom-editor %F" >> AxiomApp.AppDir/axiom.desktop && \
echo "Icon=axiom" >> AxiomApp.AppDir/axiom.desktop && \
echo "Type=Application" >> AxiomApp.AppDir/axiom.desktop && \
echo "StartupNotify=false" >> AxiomApp.AppDir/axiom.desktop && \
echo "StartupWMClass=Axiom" >> AxiomApp.AppDir/axiom.desktop && \
echo "Categories=TextEditor;Development;IDE;" >> AxiomApp.AppDir/axiom.desktop && \
echo "MimeType=application/x-axiom-workspace;" >> AxiomApp.AppDir/axiom.desktop && \
echo "Keywords=axiom;" >> AxiomApp.AppDir/axiom.desktop && \
echo "Actions=new-empty-window;" >> AxiomApp.AppDir/axiom.desktop && \
echo "[Desktop Action new-empty-window]" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name=New Empty Window" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[de]=Neues leeres Fenster" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[es]=Nueva ventana vacía" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[fr]=Nouvelle fenêtre vide" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[it]=Nuova finestra vuota" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[ja]=新しい空のウィンドウ" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[ko]=새 빈 창" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[ru]=Новое пустое окно" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[zh_CN]=新建空窗口" >> AxiomApp.AppDir/axiom.desktop && \
echo "Name[zh_TW]=開新空視窗" >> AxiomApp.AppDir/axiom.desktop && \
echo "Exec=axiom-editor --new-window %F" >> AxiomApp.AppDir/axiom.desktop && \
echo "Icon=axiom" >> AxiomApp.AppDir/axiom.desktop && \
chmod +x AxiomApp.AppDir/axiom.desktop && \
cp AxiomApp.AppDir/axiom.desktop AxiomApp.AppDir/usr/share/applications/ && \
echo "[Desktop Entry]" > AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "Name=Axiom - URL Handler" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "Comment=Open source AI code editor." >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "GenericName=Text Editor" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "Exec=axiom-editor --open-url %U" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "Icon=axiom" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "Type=Application" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "NoDisplay=true" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "StartupNotify=true" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "Categories=Utility;TextEditor;Development;IDE;" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "MimeType=x-scheme-handler/axiom;" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
echo "Keywords=axiom;" >> AxiomApp.AppDir/axiom-url-handler.desktop && \
chmod +x AxiomApp.AppDir/axiom-url-handler.desktop && \
cp AxiomApp.AppDir/axiom-url-handler.desktop AxiomApp.AppDir/usr/share/applications/ && \
echo "#!/bin/bash" > AxiomApp.AppDir/AppRun && \
echo "HERE=\$(dirname \"\$(readlink -f \"\${0}\")\")" >> AxiomApp.AppDir/AppRun && \
echo "export PATH=\${HERE}/usr/bin:\${PATH}" >> AxiomApp.AppDir/AppRun && \
echo "export LD_LIBRARY_PATH=\${HERE}/usr/lib:\${LD_LIBRARY_PATH}" >> AxiomApp.AppDir/AppRun && \
echo "exec \${HERE}/usr/bin/axiom-editor --no-sandbox \"\$@\"" >> AxiomApp.AppDir/AppRun && \
chmod +x AxiomApp.AppDir/AppRun && \
chmod -R 755 AxiomApp.AppDir && \

# Strip unneeded symbols from the binary to reduce size
strip --strip-unneeded AxiomApp.AppDir/usr/bin/axiom-editor

ls -la AxiomApp.AppDir/ && \
ARCH=x86_64 ./appimagetool -n AxiomApp.AppDir Axiom-x86_64.AppImage
'

# Clean up
rm -rf AxiomApp.AppDir .dockerignore appimagetool

echo "AppImage creation complete! Your AppImage is: Axiom-x86_64.AppImage"
