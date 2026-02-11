# 1. Install Homebrew

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Add Homebrew to PATH (Apple Silicon Macs)

echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  eval "$(/opt/homebrew/bin/brew shellenv)"

# 3. Install Node.js and Git

brew install node git corepack

# optional step, pick where to download:

mkdir Programming && cd Programming && mkdir Projects && cd Projects

# 4. Install pnpm (matches project's pinned version)

corepack enable
corepack prepare pnpm@10.29.2 --activate

# 5. Clone and enter the project

git clone https://github.com/gong8/nasty-plot.git
cd nasty-plot

# 6. Install dependencies

pnpm install

# 7. Set up environment variables

cp .env.example .env

# 8. Generate Prisma client and create the SQLite database

pnpm db:generate
pnpm db:push

# 9. Seed the database with Pokemon/Smogon data

pnpm seed

# 10. Start the dev server

pnpm dev
