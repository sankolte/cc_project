# 🎓 Project Presentation & Viva Defense Guide

## Cloud-Based Web Application Monitoring & Anomaly Detection Platform
*(Cloud Computing Mini-Project)*

---

## 🎬 1. Live Demonstration Script (5-Minute Winning Walkthrough)

Follow this exact order during your practical demonstration:

### Step 1: Baseline Architecture & Healthy Cluster (1 min)
* Open the Dashboard: `http://localhost:5000` (or your EC2 Public IP).
* Point to the top badges:
  > *"Sir/Ma'am, our platform is built on AWS: EC2 hosts the application, Amazon SQS decouples ingestion, Amazon S3 archives raw JSON logs, and Amazon RDS PostgreSQL stores queryable metrics."*
* Show the main status banner: **🟢 SYSTEM HEALTHY**.
* Show that active incidents is **0**, and latency is comfortably below the **1500 ms SLA threshold**.

### Step 2: Simulate Normal Traffic (1 min)
* Click the **🟢 Normal Load** button on the UI (or run `node simulator.js normal` in terminal).
* Show requests flowing:
  * `/api/products` and `/api/order` appear in the live telemetry stream.
  * Point out that telemetry is buffered via SQS asynchronously—the target app experiences **zero slowdown**.
  * Status remains **🟢 SYSTEM HEALTHY**.

### Step 3: Inject Chaos — High Latency SLA Breach (1.5 min)
* Click the **🟡 Inject Latency** button (or run `node simulator.js slow`).
* Point to the terminal or network call hitting `POST /api/payment?delay=2200`.
* Within 2 seconds, the dashboard automatically transitions to:
  * **🚨 CRITICAL ANOMALY DETECTED**.
  * Latency chart spikes above the red dashed SLA line.
  * Incidents table generates a new entry:
    * **Type**: `HIGH_LATENCY`
    * **Severity**: `CRITICAL`
    * **Endpoint**: `/api/payment`
    * **Measured**: `~2200 ms` vs **Threshold**: `1500 ms`.
* Explain:
  > *"Our background worker pulled the message from SQS, detected that execution time crossed the 1500ms SLA boundary, and logged an incident in Amazon RDS."*

### Step 4: Inject Chaos — Server 5xx Crash (1 min)
* Click the **🔴 Trigger 500 Crash** button (or run `node simulator.js error`).
* Notice the status code distribution chart update with a red 5xx segment.
* A `SERVER_ERROR` incident is flagged with the affected endpoint `/api/error`.

### Step 5: Dual-Tier Storage Proof (30 sec)
* Click **🗄️ Flush S3** (or show the S3 bucket / archive folder).
* Explain:
  > *"To optimize cloud storage costs, raw unindexed JSON logs are periodically archived to Amazon S3 for long-term audit compliance, while RDS handles indexing for fast dashboard queries."*

---

## 💡 2. Top 10 Viva Questions & Exact Answers

### Q1: Why did you use Amazon SQS instead of writing telemetry directly into RDS?
> **Answer**: *"To achieve **loose coupling** and prevent **database contention**. If an e-commerce flash sale occurs and millions of users hit the target app, writing telemetry directly to RDS would overwhelm the database connections and crash the site. SQS buffers millions of telemetry messages without data loss, allowing workers to ingest them at a controlled pace."*

### Q2: Why use both Amazon S3 and Amazon RDS (Dual-Tier Storage)?
> **Answer**: *"Cost optimization and query efficiency. Amazon RDS is optimized for fast relational SQL queries needed by our real-time dashboard (`SELECT FROM incidents`). However, keeping years of raw JSON logs in RDS would be unnecessarily expensive. Amazon S3 offers highly durable, cheap object storage for cold data archives."*

### Q3: How does the monitoring SDK prevent slowing down the target app?
> **Answer**: *"The middleware operates **asynchronously** using fire-and-forget dispatches on the `res.on('finish')` event. It does not await a response from the monitoring server. Even if the monitoring platform crashes completely, the target app continues serving customer orders with zero latency impact."*

### Q4: How is your anomaly detection implemented?
> **Answer**: *"We implemented an **SLA Boundary Anomaly Engine** that evaluates two critical health dimensions:*
> 1. *Performance degradation: Latency $> 1500\text{ ms}$ triggers a `HIGH_LATENCY` breach.*
> 2. *Reliability degradation: HTTP 5xx errors trigger a `SERVER_ERROR` incident.*
> *This maps directly to real-world cloud Site Reliability Engineering (SRE) practices."*

### Q5: How is security handled in your AWS deployment?
> **Answer**:
> * *"**AWS IAM (Least Privilege)**: EC2 instances use attached IAM instance profiles with restricted permissions (`sqs:SendMessage`, `sqs:ReceiveMessage`, `s3:PutObject`) rather than hardcoding secret access keys in the codebase."*
> * *"**Security Groups**: The RDS database is placed in a private subnet, allowing inbound traffic on port 5432 **only** from the EC2 security group, shielding the database from the public internet."*

### Q6: What is the difference between Amazon CloudWatch and your custom platform?
> **Answer**: *"Amazon CloudWatch monitors **infrastructure-level** metrics (EC2 CPU usage, disk I/O, SQS queue depth). Our platform monitors **application-level** telemetry (specific route latency, endpoint HTTP status codes, business transaction SLA breaches). They complement each other."*

### Q7: What happens if the background worker crashes? Is telemetry lost?
> **Answer**: *"No. Because telemetry resides safely in Amazon SQS, messages stay buffered in the queue until the worker service recovers and resumes polling."*

### Q8: What AWS Free-Tier resources did you select to prevent unwanted charges?
> **Answer**:
> * *EC2: `t2.micro` or `t3.micro` (750 hours/month free).*
> * *RDS: `db.t3.micro` PostgreSQL, Single-AZ, 20GB General Purpose SSD.*
> * *SQS: 1,000,000 requests/month free.*
> * *S3: 5 GB standard storage free.*

### Q9: Can this platform monitor multiple web applications?
> **Answer**: *"Yes. The architecture is modular. Multiple independent applications can include the middleware and dispatch telemetry to the ingestion endpoint; messages are partitioned by endpoint or application ID."*

### Q10: Why did you choose Vanilla JS & Chart.js for the dashboard instead of a heavier framework like Next.js?
> **Answer**: *"For **operational simplicity and zero-build deployment**. On a lightweight cloud instance like an EC2 `t2.micro`, heavy SSR frameworks consume significant memory and require multi-step builds. Serving static HTML/JS directly via Express eliminates CORS issues, eliminates build steps, and keeps RAM usage under 150MB."*
