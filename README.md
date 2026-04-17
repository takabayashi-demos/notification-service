# notification-service

Customer communication service handling email, SMS, and push notification delivery.

**Team:** Customer Comms  
**Stack:** Node.js, Express  
**Port:** 8080 (default)

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
node app.js

# Run with custom port
PORT=3000 node app.js
```

## API Endpoints

### Health Check

**GET** `/health`

Returns service health status.

**Response:**
```json
{
  "status": "UP",
  "timestamp": "2026-04-17T10:30:00.000Z"
}
```

### Queue Notification

**POST** `/api/v1/queue`

Enqueues a notification for delivery.

**Request Body:**
```json
{
  "to": "user@example.com,admin@example.com",
  "message": "Your order has shipped",
  "channel": "email",
  "priority": "high"
}
```

**Parameters:**
- `to` (required, string): Comma-separated recipient list
- `message` (required, string): Notification content
- `channel` (optional, string): Delivery channel - `email`, `sms`, or `push` (default: `email`)
- `priority` (optional, string): Queue priority - `low`, `normal`, or `high` (default: `normal`)

**Response (201):**
```json
{
  "id": "notif-1",
  "recipients": ["user@example.com", "admin@example.com"],
  "message": "Your order has shipped",
  "channel": "email",
  "priority": "high",
  "status": "queued",
  "createdAt": "2026-04-17T10:30:00.000Z"
}
```

**Error Responses:**
- `400` - Missing or invalid required fields
- `500` - Internal server error

**Example:**
```bash
curl -X POST http://localhost:8080/api/v1/queue \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer@walmart.com",
    "message": "Order #12345 confirmed",
    "channel": "email",
    "priority": "normal"
  }'
```

### Get Queue Status

**GET** `/api/v1/queue?limit=50`

Retrieves recent notifications from queue.

**Query Parameters:**
- `limit` (optional, number): Max items to return (default: 50, max: 200)

**Response:**
```json
{
  "items": [
    {
      "id": "notif-1",
      "recipients": ["user@example.com"],
      "message": "Your order has shipped",
      "channel": "email",
      "priority": "normal",
      "status": "queued",
      "createdAt": "2026-04-17T10:30:00.000Z"
    }
  ],
  "total": 1
}
```

**Example:**
```bash
curl http://localhost:8080/api/v1/queue?limit=10
```

## Architecture

### Queue Storage
In-memory queue implementation. Notifications are held in a FIFO array until processed by downstream workers.

**Note:** This is a stateless service. Queue state is lost on restart. For production, integrate with Redis or a message broker.

### Notification Flow
1. Client sends notification request via POST
2. Service validates required fields and recipient format
3. Notification is assigned a unique ID and enqueued
4. Background workers (external) poll `/api/v1/queue` and process items
5. Workers mark notifications as sent in external tracking system

### Channel Support
- **email**: Standard transactional emails
- **sms**: Text messages via carrier integration
- **push**: Mobile app push notifications

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |

## Testing

```bash
# Run test suite
npm test

# Manual health check
curl http://localhost:8080/health
```

## Deployment

Service runs as a container in Kubernetes. See `k8s/` directory for manifests.

**Container Port:** 8080  
**Liveness Probe:** GET `/health`  
**Readiness Probe:** GET `/health`

## Monitoring

- **Metrics:** Exported to Datadog
- **Logs:** Structured JSON to stdout
- **Alerts:** PagerDuty integration for errors

## Owner

**Team:** Customer Comms  
**Slack:** #team-customer-comms  
**On-call:** PagerDuty rotation
