# Noodles Points System

## Points Distribution

The system distributes a fixed amount of points per period (e.g., weekly), calculated daily (**100,000 points distributed per day**).

* **75%** → Distributed proportionally to protocol revenue contribution.  
  * Example: If you contributed **1 ETH** in fees out of **4 ETH** total revenue, you get:  
    `1/4 * 75% * 100,000 = 18,750 points`

* **15%** → Distributed proportionally to the value of **Noodles tokens** held in your portfolio.  
  * Example: If your holdings are **1 ETH** in value out of **4 ETH** total, you get:  
    `1/4 * 15% * 100,000 = 3,750 points`

* **4%** → Distributed based on **referral fees earned**.  
  * Example: If you earned **1 ETH** in referral fees out of **4 ETH** total, you get:  
    `1/4 * 4% * 100,000 = 1,000 points`

* **6%** → Equally distributed to all wallets that traded **≥ 0.03 ETH** that day.  
  * Example: If **30 wallets** qualified, you get:  
    `1/30 * 6% * 100,000 = 200 points`

### **Total Example Calculation**

`18,750 (fees) + 3,750 (holdings) + 1,000 (referrals) + 200 (trades) = 23,700 points` earned in one day.

### **Notes**

* Each point corresponds to **1 $NOOD** (to be confirmed).
* The daily points distribution could change to be **dynamic**, for example:  
  `100,000 + (10,000 * protocol revenue in ETH)`

## **API Endpoints**

### **Public API**

* **GET** `/points/[user_address]?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  * Fetch points data for a user.  
  * **Optional:** `from` and `to` (default = previous Monday → Sunday).

### **Daily Cron Job**

* **GET** `/points?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  * Computes points for a given period.  
  * **Optional:** `from` and `to` (default = past day).

## Development Setup

### Environment Variables

1. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and update the values:

   | Variable          | Description                                   | Example Value |
   |-------------------|-----------------------------------------------|--------------|
   | `CRON_SECRET`     | Secret key for cron job security              | `anystring` |
   | `DATABASE_URL`    | PostgreSQL connection URL                     | `postgresql://user:mdp@dburl` |
   | `DEV`             | Enable development mode                       | `true` |
   | `GRAPH_API_URL`   | Subgraph endpoint                             | `https://api.studio.thegraph.com/...` |

3. Persist environment variables globally to allow The Graph Client CLI to create a runtime artifact:

   ```bash
   echo "export GRAPH_API_URL=<GRAPH_API_URL>" >> ~/.bashrc && source ~/.bashrc
   ```

### Start the Development Server

```bash
npm install
npm run graph-build
npm run dev
```
