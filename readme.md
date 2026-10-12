# ☁️ Cloud-Based Web Application Monitoring & Anomaly Detection Platform

> A cloud-native monitoring platform that observes web application health, latency, and failure rates in real time. Built using **AWS EC2, Amazon SQS, Amazon S3, Amazon RDS**, and a lightweight Express.js telemetry middleware.

---

## 📌 Project Overview

Modern web applications continuously generate operational telemetry (requests, response latencies, HTTP status codes, and server errors). Manually identifying performance degradation or server outages is slow and error-prone.

This project delivers a **Cloud-Based Web Application Monitoring & Anomaly Detection Platform** designed with enterprise cloud patterns:

1. **Lightweight Instrumentation**: A developer integrates a simple 30-line middleware (`monitor.js`) into their web application.
2. **Asynchronous Cloud Ingestion**: Telemetry is dispatched to a cloud API that pushes events into **Amazon SQS**, completely decoupling ingestion from data processing.
3. **Dual-Tier Cloud Storage**:
   * **Amazon S3**: Inexpensive, durable cold storage for raw JSON telemetry archives.
   * **Amazon RDS (PostgreSQL/MySQL)**: High-performance relational database for real-time querying, metric rollups, and incident records.
4. **Anomaly Detection**: An automated detection engine flags abnormal SLA breaches (high latency, 5xx server error bursts, traffic surges) and raises trackable incidents.
5. **Real-Time Web Dashboard**: Displays live health indicators (🟢 Healthy vs. 🔴 Critical), throughput, latency charts, and active incident details.
6. **Chaos Traffic Simulator**: A CLI tool to simulate normal loads, artificial database bottlenecks (latency spikes), and server error bursts during live demonstrations.

---

## 🏗️ Cloud System Architecture

```text
 ┌────────────────────────────────────────┐
 │           Target Application           │
 │       (e.g., E-Commerce Service)       │
 │                                        │
 │   Routes:                              │
 │   - GET  /api/products                 │
 │   - POST /api/order                    │
 │   - POST /api/payment                  │
 │                                        │
 │   [monitor.js Middleware]              │
 └───────────────────┬────────────────────┘
                     │  HTTP POST /api/telemetry
                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Monitoring Platform (AWS)                         │
 │                                                                        │
 │  ┌─────────────────────────┐                                           │
 │  │      Ingestion API      │ (Hosted on AWS EC2)                       │
 │  └────────────┬────────────┘                                           │
 │               │                                                        │
 │               ▼                                                        │
 │  ┌─────────────────────────┐                                           │
 │  │       Amazon SQS        │ (Decouples ingestion from processing)     │
 │  │    (Telemetry Queue)    │                                           │
 │  └────────────┬────────────┘                                           │
 │               │                                                        │
 │               ▼                                                        │
 │  ┌─────────────────────────┐                                           │
 │  │     Worker Service      │ (Consumes SQS messages)                   │
 │  │    & Anomaly Engine     │ (Evaluates latency & error thresholds)   │
 │  └──────┬─────────────┬────┘                                           │
 │         │             │                                                │
 │         ▼             ▼                                                │
 │  ┌─────────────┐ ┌─────────────────────────┐                           │
 │  │  Amazon S3  │ │       Amazon RDS        │                           │
 │  │  (Raw Logs  │ │  (PostgreSQL / MySQL)   │                           │
 │  │   Archive)  │ │ - telemetry_logs        │                           │
 │  └─────────────┘ │ - metrics               │                           │
 │                  │ - incidents             │                           │
 │                  └────────────┬────────────┘                           │
 │                               │                                        │
 │                               ▼                                        │
 │                  ┌─────────────────────────┐                           │
 │                  │  Live Web Dashboard UI  │                           │
 │                  │  (Status, Graphs, Logs) │                           │
 │                  └─────────────────────────┘                           │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## ☁️ AWS Cloud Services & Roles

| AWS Service | Architectural Role | Why It Is Used |
| :--- | :--- | :--- |
| **Amazon EC2** | Compute Host | Runs the Node.js Monitoring Server (Ingestion API, SQS Worker, and Dashboard UI). |
| **Amazon SQS** | Message Decoupling | Buffers telemetry bursts so traffic spikes on the target application never overload the database. |
| **Amazon RDS** | Structured Storage | Managed PostgreSQL/MySQL hosting structured telemetry logs, aggregated metrics, and active incidents for fast dashboard queries. |
| **Amazon S3** | Object Archival | Cost-effective, scalable storage for archiving raw JSON telemetry logs. |
| **AWS IAM** | Security / Least Privilege | Grants EC2 instances restricted access to SQS and S3 without hardcoding API keys in code. |
| **Security Groups**| Network Firewall | Restricts RDS access so only the EC2 backend can communicate with port `5432` / `3306`. |

---

## 🗃️ Database Design (`schema.sql`)

```sql
-- 1. Individual Request Logs
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT NOT NULL,
    latency_ms INT NOT NULL
);

-- 2. Aggregated Operational Metrics
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    request_count INT DEFAULT 0,
    avg_latency INT DEFAULT 0,
    error_rate NUMERIC(5,2) DEFAULT 0.00
);

-- 3. Detected Anomaly Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) NOT NULL,            -- 'HIGH_LATENCY', 'SERVER_ERROR', 'TRAFFIC_SURGE'
    severity VARCHAR(20) NOT NULL,        -- 'WARNING', 'CRITICAL'
    endpoint VARCHAR(255) NOT NULL,
    observed_value VARCHAR(100) NOT NULL, -- e.g. '2400 ms'
    threshold_value VARCHAR(100) NOT NULL,-- e.g. '1500 ms'
    status VARCHAR(20) DEFAULT 'OPEN'     -- 'OPEN', 'RESOLVED'
);
```

---

## 🚨 Anomaly Detection Logic

The background worker evaluates incoming telemetry against defined SLA rules:

1. **High Latency Anomaly**:
   * **Condition**: Request latency $> 1500\text{ ms}$.
   * **Incident Raised**: `HIGH_LATENCY` (CRITICAL) detailing the degraded endpoint (e.g., `/api/payment`).
2. **Server Error Anomaly**:
   * **Condition**: HTTP status code $\ge 500$ or error rate $> 10\%$.
   * **Incident Raised**: `SERVER_ERROR` (CRITICAL) pointing out backend exceptions or database crashes.
3. **Traffic Surge Anomaly**:
   * **Condition**: Sudden request burst surpassing normal baseline boundaries.
   * **Incident Raised**: `TRAFFIC_SURGE` (WARNING).

---

## 📁 Repository Structure

```text
anomaly-detection/
├── target-app/               # Sample web app being monitored (Port 3000)
│   ├── server.js             # Express API with /products, /order, /payment routes
│   └── monitor.js            # Telemetry instrumentation middleware
│
├── monitor-server/           # Central monitoring platform (Port 5000)
│   ├── api.js                # Ingestion API (pushes telemetry to AWS SQS)
│   ├── worker.js             # SQS Consumer + Anomaly Detector (writes to RDS & S3)
│   ├── db.js                 # RDS / PostgreSQL connection pool
│   └── public/               # Web Dashboard frontend (HTML, CSS, Chart.js)
│       ├── index.html
│       ├── styles.css
│       └── app.js
│
├── simulator.js              # Traffic generator script for live demonstrations
├── schema.sql                # SQL database table definitions
├── phases.md                 # Project roadmap and phase tracking
└── README.md                 # Complete system documentation
```

---

## 🤖 Traffic & Chaos Simulator Modes

To demonstrate system capabilities without waiting for organic user traffic, `simulator.js` provides three automated traffic profiles:

```bash
# 1. Normal Steady Traffic (Dashboard remains 🟢 HEALTHY)
node simulator.js normal

# 2. Downstream Latency Injection (Dashboard flags 🔴 HIGH LATENCY ANOMALY)
node simulator.js slow

# 3. Server Crash / 5xx Burst (Dashboard flags 🔴 SERVER ERROR ANOMALY)
node simulator.js error
```

---

## 🎬 Live Demonstration Flow (For Evaluation & Viva)

1. **Baseline State**: Launch the Dashboard (`http://<EC2-IP>:5000`). Show that status is **🟢 HEALTHY**, average latency is low (~30ms), and incident count is zero.
2. **Inject Chaos**: Run `node simulator.js slow` in the terminal.
3. **Observe Decoupled Flow**:
   * Target app sends telemetry to Ingestion API.
   * Ingestion API immediately puts messages into **Amazon SQS**.
   * Worker pulls messages from SQS, detects latency $> 1500\text{ms}$, and inserts an incident into **Amazon RDS**.
4. **Live Dashboard Alert**: The dashboard turns **🔴 RED**, alerting to a `HIGH_LATENCY` incident with the exact affected endpoint (`POST /api/payment`) and measured latency.
5. **Verify AWS Infrastructure**:
   * Show messages processed in the **AWS SQS** console.
   * Show raw JSON dumps archived in the **AWS S3** bucket.
   * Show structured tables updated in **Amazon RDS**.

---

## 🎓 Core Cloud Concepts Highlighted

* **Asynchronous Decoupling**: Target applications never suffer latency from logging; SQS absorbs high-volume traffic bursts.
* **Dual-Tier Storage Strategy**: S3 for cheap, immutable raw log backups; RDS for fast, indexed queries.
* **Elasticity & Scalability**: Ingestion API and processing workers can scale independently based on SQS queue depth.
* **Cloud Security**: Network isolation via Security Groups (RDS kept private, accessible only by backend EC2).
