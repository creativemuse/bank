<div align="center">
<img width="200" alt="Image" src="https://github.com/user-attachments/assets/8b617791-cd37-4a5a-8695-a7c9018b7c70" />
<br>
<br>
<h1>Fintech Starter App</h1>

<div align="center">
<a href="https://fintech-starter-app.demos-crossmint.com/">Live Demo</a>  | <a href="https://docs.crossmint.com/">Docs</a> | <a href="https://crossmint.com/quickstarts">See all quickstarts</a>  | <a href="https://t.me/crossmintdevs">Join our Telegram</a> 
</div>

<br>
<br>
<img src="https://github.com/user-attachments/assets/9bd7085c-5a92-4590-ae22-f892e353efce" alt="Image" width="full">
</div>

## Table of contents

- [Introduction](#introduction)
- [Deploy](#deploy)
- [Setup](#setup)
- [Using another chain](#using-another-chain)
- [Using in production](#using-in-production)
  - [Enabling Withdrawals](#enabling-withdrawals)

## Introduction

Create your own Fintech app in minutes using **[Crossmint](https://crossmint.com)** wallets and onramp.

**Key features**

- Login with email or social media
- Automatically create non-custodial wallets for your users
- Top up with USDC using a credit or debit card
- Transfer USDC to another wallet or email address
- View your wallet activity
- Withdraw USDC to your bank account
- Support for Base mainnet (automatically enforced in production) and Base Sepolia testnet (development only)
- Passkey-based wallet security
- Leverage more than +200 onchain tools integrating [GOAT](https://github.com/goat-sdk/goat)

**Coming soon**

- Currency conversion
- Earn interest on your USDC
- Issue a debit card linked to your wallet

Get in touch with us to get early access to these features!

Join our [Telegram community](https://t.me/crossmintdevs) to stay updated on the latest features and announcements.

## Deploy

Easily deploy the template to Vercel with the button below. You will need to set the required environment variables in the Vercel dashboard.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCrossmint%2Ffintech-starter-app&env=NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY,NEXT_PUBLIC_CHAIN_ID,NEXT_PUBLIC_USDC_MINT)

## Setup

1. Clone the repository and navigate to the project folder:

```bash
git clone https://github.com/crossmint/fintech-starter-app.git && cd fintech-starter-app
```

2. Install all dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Set up the environment variables:

```bash
cp .env.template .env
```

4. Login to the <a href="https://staging.crossmint.com/console" target="_blank">Crossmint staging console</a> and get the client API key from the <a href="https://staging.crossmint.com/console/overview" target="_blank">overview page</a>:

```env
NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY=your_client_side_API_key
```

5. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Using another chain

This application currently supports the following chains:

- **`base`** - Base mainnet (production)
- **`base-sepolia`** - Base Sepolia testnet (development/testing)

To switch between chains:

1. Update the chain environment variable in your `.env` file:

```env
# For testnet/development
NEXT_PUBLIC_CHAIN_ID=base-sepolia

# For production
NEXT_PUBLIC_CHAIN_ID=base
```

2. **Important**: Make sure to update the USDC contract address for the chain you're using:

```env
# For Base mainnet
NEXT_PUBLIC_USDC_MINT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# For Base Sepolia testnet
NEXT_PUBLIC_USDC_MINT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

**Note**: 
- In **production** (`NODE_ENV=production`), the app will **always use Base mainnet** regardless of the `NEXT_PUBLIC_CHAIN_ID` setting. This ensures mainnet-only operations in production.
- In **development**, if `NEXT_PUBLIC_CHAIN_ID` is not set or contains an invalid value, the app will default to `base-sepolia` for safety.

## Using in production

This starter app is designed for rapid prototyping and testing in a staging environment. To move to production you'll need to:

1. Login to the [Crossmint production console](https://www.crossmint.com/console) and [create a client side API key](https://www.crossmint.com/console/projects/apiKeys) with the following scopes: `users.create`, `users.read`, `wallets.read`, `wallets.create`, `wallets:transactions.create`, `wallets:transactions.sign`, `wallets:transactions.read`, `wallets:balance.read`, `wallets.fund`.
2. Set the production environment variables:
   ```env
   NODE_ENV=production
   NEXT_PUBLIC_CHAIN_ID=base
   NEXT_PUBLIC_USDC_MINT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   ```
   **Note**: The app automatically enforces Base mainnet when `NODE_ENV=production`, but setting `NEXT_PUBLIC_CHAIN_ID=base` is recommended for clarity.
3. Customize your email template for login and signup in the [Crossmint console](https://www.crossmint.com/console) under the Settings tab in the Branding section.
4. For using onramp in production reach out to us on [Telegram](https://t.me/fintechstarterapp).
5. Enable withdrawals by following the [Coinbase API configuration](#enabling-withdrawals) steps below.

### Enabling Withdrawals

Withdrawals are powered by [Coinbase](https://www.coinbase.com/en-es/developer-platform) and require proper API configuration. For enabling withdrawals you'll need to:

1. [Create a Coinbase developer account](https://www.coinbase.com/en-es/developer-platform)
2. Create a Server API Key with the following permissions:
   - `wallet:addresses:read`
   - `wallet:withdrawals:create`
   - `wallet:transactions:read`
3. Add the following environment variables to your `.env` file:
   ```
   COINBASE_API_KEY_ID=your_coinbase_api_key_id_here
   COINBASE_API_KEY_SECRET=your_coinbase_api_key_secret_here
   ```
4. In the [Onramp configuration](https://portal.cdp.coinbase.com/products/onramp) add your domain to the domain allowlist

### Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Crossmint Configuration (Required)
NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY=your_crossmint_client_api_key_here

# Chain Configuration (Required)
# Supported values: base, base-sepolia
NEXT_PUBLIC_CHAIN_ID=base-sepolia
NEXT_PUBLIC_USDC_MINT=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Coinbase Offramp Configuration (Required for Withdrawals)
COINBASE_API_KEY_ID=your_coinbase_api_key_id_here
COINBASE_API_KEY_SECRET=your_coinbase_api_key_secret_here

# Wert Onramp Configuration (Optional)
WERT_API_KEY=your_wert_api_key_here
```

**USDC Contract Addresses:**

- **Base Mainnet**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Base Sepolia Testnet**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
