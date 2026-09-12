# Cloud-Based Web Application Monitoring & Anomaly Detection Platform

> A cloud-native monitoring platform that enables developers to monitor the health, performance, errors, and abnormal behavior of their web applications using a lightweight monitoring SDK and a scalable AWS-based processing pipeline.

---

## 📌 Project Overview

Modern web applications continuously generate large amounts of operational data such as HTTP requests, response times, status codes, application errors, and traffic patterns.

Manually analyzing this information makes it difficult for developers to identify performance degradation or unusual behavior quickly.

This project implements a **Cloud-Based Web Application Monitoring and Anomaly Detection Platform** that allows developers to integrate monitoring into an existing web application with minimal configuration.

The developer installs our monitoring SDK and adds a middleware to their application.

```bash
npm install <monitoring-sdk>
```

```javascript
const monitoring = require("<monitoring-sdk>");

app.use(
    monitoring({
        apiKey: "YOUR_APPLICATION_API_KEY"
    })
);
```

Once integrated, the SDK automatically collects application telemetry such as:

* HTTP request information
* Endpoint
* HTTP method
* Response status code
* Request latency
* Application errors
* Request timestamps
* Other configurable application-level metrics

The collected telemetry is securely sent to our cloud monitoring backend.

The backend uses **Amazon EC2, Amazon SQS, Amazon S3, Amazon RDS, IAM, Security Groups, and Amazon CloudWatch** to create a complete cloud-based monitoring and anomaly detection pipeline.

---

# 🎯 Problem Statement

Developers need to know when their applications are:

* Experiencing unusually high traffic
* Returning excessive HTTP 5xx errors
* Becoming slower than normal
* Experiencing repeated application failures
* Showing unusual login or request patterns
* Experiencing sudden changes in normal behavior

Traditional logging systems mainly store logs. They do not necessarily provide an easy way to identify abnormal behavior automatically.

Therefore, the goal of this project is to build a system that:

1. Collects telemetry from web applications.
2. Processes telemetry asynchronously.
3. Stores raw and structured monitoring data.
4. Calculates application-level metrics.
5. Establishes normal behavioral patterns.
6. Detects deviations from those patterns.
7. Displays application health and detected incidents through a dashboard.

---

# 💡 What Are We Building?

We are building a **generic web application monitoring platform**.

The platform is **not limited to a particular e-commerce application**.

A developer can integrate our monitoring SDK into a supported web application and start sending telemetry to our monitoring infrastructure.

For demonstration purposes, we use a simple e-commerce application as the **target application**.

### Important distinction

```text
Target Application
        │
        │ monitored by
        ▼
Our Monitoring Platform
```

The e-commerce application is only used to demonstrate how the monitoring platform works.

Our actual project is the **monitoring and anomaly detection platform**.

---

# 🏗️ High-Level Architecture

```text
                    ┌─────────────────────────┐
                    │    Developer's Web App  │
                    │                         │
                    │  Node.js / Express App  │
                    └────────────┬────────────┘
                                 │
                         Monitoring SDK
                            Middleware
                                 │
                                 │ HTTPS
                                 ▼
                    ┌─────────────────────────┐
                    │   Monitoring API        │
                    │      AWS EC2            │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Amazon SQS         │
                    │   Telemetry Queue       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    Worker Service       │
                    │    Docker + EC2         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
          ┌─────────────────┐       ┌─────────────────┐
          │   Amazon S3     │       │   Amazon RDS    │
          │   Raw Logs      │       │ Structured Data │
          └─────────────────┘       └────────┬────────┘
                                             │
                                             ▼
                                  ┌────────────────────┐
                                  │ Anomaly Detection  │
                                  │      Engine        │
                                  └─────────┬──────────┘
                                            │
                                            ▼
                                  ┌────────────────────┐
                                  │ Monitoring         │
                                  │ Dashboard          │
                                  └────────────────────┘


          AWS Infrastructure Monitoring
                     │
                     ▼
              Amazon CloudWatch

          Security
              │
       ┌──────┴────────┐
       ▼               ▼
      IAM        Security Groups
```

---

# 🔄 Complete Data Flow

## Step 1 — Developer Integrates the SDK

The developer creates an application in the monitoring dashboard and receives an application API key.

The developer then installs our SDK:

```bash
npm install <monitoring-sdk>
```

and adds the monitoring middleware:

```javascript
app.use(
    monitoring({
        apiKey: "YOUR_APPLICATION_API_KEY"
    })
);
```

No AWS configuration is required on the developer's application.

The developer does **not** need direct access to our S3, RDS, SQS, or EC2 infrastructure.

---

## Step 2 — Application Generates Telemetry

Suppose the developer's application receives:

```text
POST /api/payment
```

The SDK can capture information such as:

```json
{
  "timestamp": "2026-09-13T10:32:10Z",
  "endpoint": "/api/payment",
  "method": "POST",
  "status_code": 500,
  "latency_ms": 2430,
  "message": "Database timeout"
}
```

The SDK does not need to upload the application's entire source code.

It observes the application's runtime behavior and sends relevant monitoring telemetry.

---

# 🔐 Step 3 — Secure Telemetry Transmission

The SDK sends telemetry to our monitoring API through HTTPS.

Example:

```http
POST /v1/telemetry
Authorization: Bearer <APPLICATION_API_KEY>
Content-Type: application/json
```

Example payload:

```json
{
  "application_id": "app_123",
  "event_type": "http_request",
  "timestamp": "2026-09-13T10:32:10Z",
  "payload": {
    "endpoint": "/api/payment",
    "method": "POST",
    "status_code": 500,
    "latency_ms": 2430
  }
}
```

The API key identifies the monitored application.

It is **not an AWS credential**.

---

# ☁️ Step 4 — Monitoring API

The Monitoring API is hosted on an AWS EC2 instance.

Its responsibilities include:

* Authenticating applications
* Validating telemetry
* Normalizing incoming events
* Adding application metadata
* Sending telemetry to Amazon SQS
* Providing APIs for the dashboard

The API does not perform expensive processing synchronously.

Instead, it pushes telemetry into SQS and allows workers to process it asynchronously.

---

# 📬 Step 5 — Amazon SQS

Amazon SQS acts as the message queue between the API and processing workers.

```text
Monitoring API
      │
      ▼
     SQS
      │
      ▼
   Worker
```

This provides an important separation between:

**Data ingestion** and **data processing**.

### Why SQS?

Without a queue:

```text
User Request
     ↓
Monitoring API
     ↓
Process telemetry
     ↓
Store data
```

A sudden increase in traffic could overload the API.

With SQS:

```text
User Request
     ↓
Monitoring API
     ↓
SQS
     ↓
Worker processes gradually
```

This makes the system more resilient to traffic spikes.

---

# ⚙️ Step 6 — Worker Service

The worker consumes telemetry messages from SQS.

The worker can run inside a Docker container hosted on EC2.

Its responsibilities include:

1. Reading messages from SQS.
2. Validating telemetry.
3. Processing logs.
4. Calculating metrics.
5. Storing raw logs.
6. Storing structured data.
7. Running anomaly detection.
8. Creating incidents when anomalies are detected.

---

# 🗄️ Step 7 — Data Storage

The project uses two different storage mechanisms because raw logs and queryable application data have different requirements.

## Amazon S3 — Raw Logs

Raw telemetry can be stored in Amazon S3.

Example structure:

```text
s3://monitoring-data/
│
├── application-123/
│   ├── 2026/
│   │   ├── 09/
│   │   │   ├── 13/
│   │   │   │   ├── logs.json
│   │   │   │   └── logs-2.json
```

S3 provides inexpensive and durable storage for historical raw telemetry.

---

## Amazon RDS — Structured Data

Important structured information is stored in a relational database.

Example tables:

```text
applications
api_keys
telemetry_logs
metrics
incidents
health_checks
```

RDS is used because the dashboard needs to query information efficiently.

For example:

```sql
SELECT *
FROM incidents
WHERE application_id = 'app_123'
ORDER BY created_at DESC;
```

---

# 📊 Metrics Calculation

The worker aggregates telemetry into useful application metrics.

Examples include:

### Request Count

```text
Requests/minute
Requests/hour
Requests/day
```

### Error Rate

```text
error_rate =
(number of failed requests / total requests) × 100
```

### Average Latency

```text
average_latency =
sum(request latency) / number of requests
```

### Status Distribution

```text
2xx → Successful requests
3xx → Redirects
4xx → Client errors
5xx → Server errors
```

### Other Metrics

* Endpoint-wise latency
* Endpoint-wise error rate
* Failed login attempts
* Traffic spikes
* Maximum latency
* Request frequency

---

# 🚨 Anomaly Detection

The central feature of the project is detecting unusual application behavior.

The system first establishes what is considered **normal behavior**.

For example:

```text
Normal Traffic:
1000 requests/min

Normal Error Rate:
1–2%

Normal Average Latency:
100–200 ms
```

If the application's behavior suddenly changes:

```text
Traffic:
1000 → 20,000 requests/min

Error Rate:
2% → 30%

Latency:
150 ms → 2500 ms
```

the system identifies this as abnormal behavior.

---

# 🧠 Anomaly Detection Approaches

## 1. Threshold-Based Detection

The MVP can use predefined thresholds.

Example:

```javascript
if (errorRate > 10) {
    anomaly = "HIGH_ERROR_RATE";
}

if (averageLatency > 2000) {
    anomaly = "HIGH_LATENCY";
}
```

This approach is simple, explainable, and suitable for the initial implementation.

---

## 2. Statistical Detection

The system can later compare current metrics with historical behavior.

One approach is the Z-score:

```text
z = (x - μ) / σ
```

where:

* `x` = current metric
* `μ` = historical mean
* `σ` = standard deviation

A sufficiently large deviation can be classified as an anomaly.

This allows the system to detect unusual behavior relative to an application's own baseline.

---

# 🚨 Example Incident

Suppose the application normally has:

```text
Average latency: 150 ms
Error rate: 1.5%
```

Suddenly:

```text
Average latency: 2430 ms
Error rate: 28%
```

The anomaly engine detects:

```text
Incident #1024

Type:
HIGH_LATENCY

Severity:
HIGH

Endpoint:
POST /api/payment

Current Latency:
2430 ms

Baseline:
150 ms
```

The dashboard can then display the incident to the developer.

---

# 📈 Monitoring Dashboard

The dashboard provides a centralized view of monitored applications.

## Application Overview

```text
Application: Demo E-Commerce App

Status: ● Healthy

Requests/min     1,245
Error Rate       1.8%
Avg Latency      142 ms
5xx Errors       12
Active Incidents 0
```

---

## Incident View

When abnormal behavior is detected:

```text
⚠ HIGH LATENCY DETECTED

Application:
Demo E-Commerce App

Endpoint:
/api/payment

Current:
2430 ms

Baseline:
150 ms

Detected:
10:32 AM
```

---

# 🧪 Demo Target Application

For demonstration purposes, the project includes a simple e-commerce application.

This application is **not the monitoring platform**.

It is simply a target application used to generate realistic telemetry.

Example APIs:

```text
POST /login
GET  /products
GET  /products/:id
POST /cart
POST /orders
POST /payment
GET  /orders/:id
```

The monitoring SDK is integrated into this application.

---

# 🤖 Traffic Simulator

To demonstrate anomaly detection reliably, the project includes a traffic simulator.

The simulator generates different traffic conditions.

### NORMAL

```text
Normal request rate
Low error rate
Normal latency
```

### HIGH_TRAFFIC

```text
Sudden increase in requests
```

### HIGH_ERROR

```text
Large number of 4xx/5xx responses
```

### HIGH_LATENCY

```text
Artificially delayed responses
```

### LOGIN_ATTACK

```text
Large number of failed login attempts
```

This allows the team to demonstrate anomaly detection without depending on unpredictable real-world traffic.

---

# 🧪 Example Demo Scenario

### Normal State

```text
Requests/min: 1000
Error Rate: 1.5%
Latency: 150 ms

Status: HEALTHY
```

Then the simulator activates:

```text
HIGH_LATENCY
```

The application starts producing:

```text
Latency:
150 ms → 2500 ms
```

Telemetry flows through:

```text
SDK
 ↓
Monitoring API
 ↓
SQS
 ↓
Worker
 ↓
RDS
 ↓
Anomaly Detection
 ↓
Dashboard
```

The dashboard eventually displays:

```text
⚠ HIGH LATENCY ANOMALY

Baseline: 150 ms
Current: 2500 ms
```

This provides a clear end-to-end demonstration of the system.

---

# 🌐 External URL Monitoring

The platform can also support monitoring applications without deep SDK integration.

A developer can provide a public URL or health-check endpoint:

```text
https://example.com/health
```

The monitoring service can periodically check:

* Availability
* HTTP status
* Response time
* Connection failures
* External uptime

However, URL-only monitoring has limitations.

If we only have:

```text
https://example.com
```

we can observe the application from the outside.

We **cannot automatically see internal information** such as:

* Database query latency
* Internal exceptions
* Individual backend routes
* Internal service failures
* Failed login counts

For deeper application-level monitoring, the SDK or telemetry API is required.

---

# 🔐 Security Architecture

Security is an important part of the cloud implementation.

## IAM

AWS IAM is used to provide controlled access to AWS resources.

Example principle:

```text
Monitoring Worker
      │
      ├── S3 access
      └── SQS access

Dashboard/API
      │
      └── Required RDS/API permissions
```

The system follows the principle of **least privilege**.

Applications should not receive AWS credentials.

---

## Security Groups

EC2 security groups control network access.

Example:

```text
Internet
   │
   ▼
EC2
 │
 ├── HTTP/HTTPS
 │
 └── Application API

RDS
 │
 └── Accessible only from authorized backend instances
```

The database should not be directly exposed to the public internet.

---

## API Authentication

Applications authenticate telemetry requests using an application-specific API key.

```http
Authorization: Bearer <API_KEY>
```

The API key can be revoked or rotated if required.

---

# 📡 Amazon CloudWatch

CloudWatch is used for **infrastructure-level monitoring** of our AWS deployment.

Examples:

* EC2 CPU utilization
* EC2 memory/system metrics where configured
* Application logs
* SQS queue depth
* Worker health
* Infrastructure failures

This is different from our custom anomaly detection.

### Our Monitoring Platform

Monitors:

```text
Application-level behavior

Latency
Error rate
Traffic
Endpoint failures
Application anomalies
```

### CloudWatch

Monitors:

```text
AWS infrastructure

EC2
SQS
Logs
Infrastructure metrics
```

Together they provide both application-level and infrastructure-level visibility.

---

# 🧱 Project Components

```text
monitoring-platform/
│
├── sdk/
│   ├── src/
│   │   ├── middleware.js
│   │   ├── telemetry.js
│   │   └── client.js
│   └── package.json
│
├── monitoring-api/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   │   └── sqs.js
│   │   └── server.js
│   └── package.json
│
├── worker/
│   ├── src/
│   │   ├── consumer.js
│   │   ├── processor.js
│   │   ├── metrics.js
│   │   └── anomalyDetector.js
│   ├── Dockerfile
│   └── package.json
│
├── dashboard/
│   ├── src/
│   └── package.json
│
├── demo-app/
│   ├── src/
│   ├── routes/
│   ├── middleware/
│   └── package.json
│
├── traffic-simulator/
│   ├── simulator.js
│   └── package.json
│
└── README.md
```

---

# 🗃️ Database Design

## Applications

```text
applications
-------------------------
id
name
api_key
url
created_at
status
```

## Telemetry Logs

```text
telemetry_logs
-------------------------
id
application_id
timestamp
endpoint
method
status_code
latency_ms
message
```

## Metrics

```text
metrics
-------------------------
id
application_id
timestamp
request_count
error_rate
avg_latency
max_latency
```

## Incidents

```text
incidents
-------------------------
id
application_id
type
severity
metric
baseline_value
current_value
description
created_at
status
```

---

# 🔌 API Design

## Create Application

```http
POST /v1/applications
```

Creates a monitored application and generates its application credentials.

---

## Send Telemetry

```http
POST /v1/telemetry
```

Receives telemetry from the SDK.

---

## Get Application Health

```http
GET /v1/applications/:id/health
```

Returns the current health status.

---

## Get Metrics

```http
GET /v1/applications/:id/metrics
```

Returns application metrics.

---

## Get Incidents

```http
GET /v1/applications/:id/incidents
```

Returns detected anomalies and incidents.

---

# 🐳 Docker

The worker service can be containerized using Docker.

Example:

```text
Docker Container
       │
       ▼
Worker Service
       │
       ├── SQS
       ├── S3
       └── RDS
```

Docker provides:

* Consistent runtime environment
* Easier deployment
* Isolation
* Reproducibility
* Easier worker scaling

---

# ☁️ AWS Services Used

| AWS Service         | Purpose                                |
| ------------------- | -------------------------------------- |
| **EC2**             | Hosts monitoring API / worker services |
| **SQS**             | Asynchronous telemetry processing      |
| **S3**              | Raw telemetry/log storage              |
| **RDS**             | Structured monitoring data             |
| **IAM**             | Access control and permissions         |
| **Security Groups** | Network-level security                 |
| **CloudWatch**      | Infrastructure monitoring and logs     |

---

# 📦 Technology Stack

### Backend

* Node.js
* Express.js

### Monitoring SDK

* JavaScript / Node.js
* HTTP-based telemetry

### Database

* PostgreSQL / MySQL on Amazon RDS

### Cloud

* Amazon EC2
* Amazon S3
* Amazon SQS
* Amazon CloudWatch
* AWS IAM

### Containerization

* Docker

### Frontend

* React.js / Next.js

### Development

* Git
* GitHub
* REST APIs

---

# 🧑‍💻 Scalability

The architecture is designed to separate ingestion from processing.

Instead of:

```text
API → Processing
```

we use:

```text
API → SQS → Workers
```

Therefore, if telemetry volume increases:

```text
             ┌── Worker 1
SQS ─────────┼── Worker 2
             ├── Worker 3
             └── Worker N
```

Additional workers can process messages in parallel.

This makes the architecture suitable for future scaling.

---

# 🛡️ Failure Handling

The system should be designed so that temporary worker failures do not immediately result in data loss.

Because telemetry first enters SQS:

```text
SDK
 ↓
API
 ↓
SQS
 ↓
Worker
```

if a worker temporarily fails, messages can remain in the queue until they can be processed again.

A **Dead Letter Queue (DLQ)** can be added as a future enhancement for messages that repeatedly fail processing.

---

# 🎬 Final Demonstration Flow

During the practical demonstration, the following flow can be shown:

### 1. Start the demo application

```text
Demo E-Commerce App
```

### 2. Show SDK integration

```bash
npm install <monitoring-sdk>
```

and:

```javascript
app.use(monitoring({
    apiKey: "..."
}));
```

### 3. Start monitoring backend

```text
Monitoring API → EC2
```

### 4. Generate normal traffic

Show:

```text
Healthy
Low error rate
Normal latency
```

### 5. Trigger an anomaly

For example:

```text
HIGH_LATENCY
```

or:

```text
HIGH_ERROR
```

### 6. Show SQS

Demonstrate telemetry entering the queue.

### 7. Show Worker

Worker consumes and processes telemetry.

### 8. Show S3 and RDS

Demonstrate:

```text
Raw logs → S3

Structured data → RDS
```

### 9. Show anomaly detection

```text
Baseline
    ↓
Current metric
    ↓
Deviation detected
    ↓
Incident created
```

### 10. Show Dashboard

```text
⚠ HIGH LATENCY DETECTED
```

### 11. Show CloudWatch + IAM

Demonstrate the AWS monitoring and security mechanisms required by the practical.

---

# 👥 Suggested Team Division

For a team of four:

### Member 1 — Monitoring SDK & Demo Application

Responsibilities:

* SDK development
* Express middleware
* Telemetry collection
* Demo application integration

### Member 2 — Cloud Backend

Responsibilities:

* Monitoring API
* EC2 deployment
* SQS integration
* API authentication

### Member 3 — Processing & Anomaly Detection

Responsibilities:

* Worker service
* S3
* RDS
* Metrics calculation
* Anomaly detection

### Member 4 — Dashboard & Cloud Security

Responsibilities:

* Dashboard
* Incident visualization
* IAM
* Security Groups
* CloudWatch
* Deployment/documentation

---

# 🚀 Future Enhancements

The current implementation can be extended with:

* Real-time alerts
* Email notifications
* Slack/Discord notifications
* Multiple SDK languages
* Python/FastAPI SDK
* Java/Spring SDK
* Distributed tracing
* Automatic incident severity classification
* Machine-learning-based anomaly detection
* Automatic scaling of workers
* SQS Dead Letter Queue
* Application health scoring
* Historical performance analysis
* Custom alert rules
* Deployment/version tracking
* Multi-tenant monitoring

---

# 🎓 Learning Outcomes

This project demonstrates practical knowledge of:

* Cloud computing architecture
* AWS EC2
* Amazon S3
* Amazon SQS
* Amazon RDS
* IAM
* Security Groups
* CloudWatch
* Docker
* REST APIs
* Middleware development
* Asynchronous processing
* Distributed systems concepts
* Database design
* Application monitoring
* Statistical anomaly detection
* Cloud deployment
* Fault tolerance and scalability

---

# 📌 Key Design Principle

The most important idea behind this project is:

> **The developer's application generates telemetry; our cloud platform processes, stores, analyzes, and visualizes it.**

The developer does not need to manage our AWS infrastructure.

Their responsibility is simply:

```text
Install SDK
     ↓
Configure API Key
     ↓
Add Middleware
     ↓
Run Application
```

Our platform handles:

```text
Telemetry Ingestion
       ↓
SQS
       ↓
Processing
       ↓
S3 + RDS
       ↓
Metrics
       ↓
Anomaly Detection
       ↓
Dashboard
```

---

# 🏁 Conclusion

The **Cloud-Based Web Application Monitoring & Anomaly Detection Platform** provides a lightweight way for developers to monitor their web applications without building a complete monitoring infrastructure themselves.

By integrating a small monitoring SDK/middleware, applications can send runtime telemetry to a centralized AWS-based platform.

The system combines:

**Application Monitoring + Asynchronous Processing + Cloud Storage + Relational Database + Anomaly Detection + Infrastructure Monitoring + Security**

using AWS services such as **EC2, SQS, S3, RDS, IAM, Security Groups, and CloudWatch**.

The architecture demonstrates how a cloud-native monitoring system can collect application behavior, process high volumes of telemetry asynchronously, identify abnormal patterns, and present actionable incidents to developers through a centralized dashboard.
