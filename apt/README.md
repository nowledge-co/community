# Nowledge Mem APT Repository

Install Nowledge Mem on Debian/Ubuntu with automatic updates via `apt upgrade`.

## Quick Install

```bash
curl -fsSL https://nowledge-co.github.io/community/apt/install.sh | sudo bash
```

This will:
1. Add the Nowledge Mem GPG signing key
2. Configure the APT repository
3. Update your package index

Then install:
```bash
sudo apt-get install nowledge-mem
```

## Manual Setup

If you prefer to set things up manually:

```bash
# 1. Install the GPG signing key
sudo curl -fsSL https://nowledge-co.github.io/community/apt/nowledge-mem-archive-keyring.gpg \
    -o /usr/share/keyrings/nowledge-mem-archive-keyring.gpg

# 2. Add the repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/nowledge-mem-archive-keyring.gpg] https://download-mem.nowledge.co/apt stable main" \
    | sudo tee /etc/apt/sources.list.d/nowledge-mem.list

# 3. Update and install
sudo apt-get update
sudo apt-get install nowledge-mem
```

## Automatic Updates

Once installed via the APT repository, Nowledge Mem will be updated automatically when you run:

```bash
sudo apt-get update && sudo apt-get upgrade
```

If your system has `unattended-upgrades` configured, updates will be applied automatically.

## Supported Architectures

- `amd64` (x86_64)

## Uninstall

```bash
# Remove the package
sudo apt-get remove nowledge-mem

# Remove the repository
sudo rm /etc/apt/sources.list.d/nowledge-mem.list
sudo rm /usr/share/keyrings/nowledge-mem-archive-keyring.gpg
```

## Security

The repository is signed with a GPG key. The public key fingerprint is published at:
- https://nowledge-co.github.io/community/apt/nowledge-mem-archive-keyring.gpg
- https://nowledge-co.github.io/community/apt/nowledge-mem-archive-keyring.asc (ASCII-armored)

Report security issues to hello@nowledge-labs.ai.
