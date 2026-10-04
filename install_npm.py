import os
import tarfile
import urllib.request
import shutil

NODE_DIR = r"C:\Users\Khushi\AppData\Local\Programs\nodejs"
TAR_PATH = os.path.join(NODE_DIR, "npm.tgz")
EXTRACT_DIR = os.path.join(NODE_DIR, "npm_extract")
TARGET_NPM_DIR = os.path.join(NODE_DIR, "node_modules", "npm")

print("1. Downloading npm...")
url = "https://registry.npmjs.org/npm/-/npm-10.8.2.tgz"
urllib.request.urlretrieve(url, TAR_PATH)
print("Downloaded npm.tgz")

print("2. Extracting npm...")
with tarfile.open(TAR_PATH, "r:gz") as tar:
    tar.extractall(EXTRACT_DIR)

package_dir = os.path.join(EXTRACT_DIR, "package")
os.makedirs(os.path.join(NODE_DIR, "node_modules"), exist_ok=True)

if os.path.exists(TARGET_NPM_DIR):
    shutil.rmtree(TARGET_NPM_DIR)

shutil.move(package_dir, TARGET_NPM_DIR)

# Copy npm, npm.cmd, npx, npx.cmd to NODE_DIR
for fname in ["npm", "npm.cmd", "npx", "npx.cmd"]:
    src = os.path.join(TARGET_NPM_DIR, "bin", fname)
    dst = os.path.join(NODE_DIR, fname)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"Installed {fname} -> {dst}")

# Clean up
if os.path.exists(TAR_PATH):
    os.remove(TAR_PATH)
if os.path.exists(EXTRACT_DIR):
    shutil.rmtree(EXTRACT_DIR)

print("SUCCESS: npm installed successfully into nodejs directory!")
