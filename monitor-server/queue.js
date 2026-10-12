
  // monitor-server/queue.js
// Asynchronous message queue supporting Amazon SQS with seamless in-memory fallback

const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

// In-Memory Queue Fallback
const inMemoryQueue = [];
let sqsClient = null;
let sqsQueueUrl = null;

function initQueue() {
  const useMock = process.env.USE_MOCK_AWS === 'true';
  sqsQueueUrl = process.env.AWS_SQS_QUEUE_URL;

  if (!useMock && sqsQueueUrl && process.env.AWS_REGION) {
    try {
      sqsClient = new SQSClient({ region: process.env.AWS_REGION });
      console.log(`📬 [Queue] Connected to Amazon SQS at: ${sqsQueueUrl}`);
      return;
    } catch (err) {
      console.warn(`[Queue] Failed to initialize AWS SQS Client: ${err.message}. Using mock queue.`);
    }
  }

  console.log('📬 [Queue] Operating in Mock / In-Memory Queue mode (Local development).');
}

/**
 * Push telemetry payload into queue
 */
async function sendToQueue(telemetryPayload) {
  const messageBody = JSON.stringify(telemetryPayload);

  if (sqsClient && sqsQueueUrl) {
    try {
      const command = new SendMessageCommand({
        QueueUrl: sqsQueueUrl,
        MessageBody: messageBody
      });
      const response = await sqsClient.send(command);
      return { success: true, messageId: response.MessageId };
    } catch (err) {
      console.warn(`[Queue] SQS Send failed (${err.message}). Buffering in mock queue.`);
    }
  }

  // In-memory queue fallback
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  inMemoryQueue.push({
    messageId,
    body: messageBody,
    receiptHandle: messageId
  });

  return { success: true, messageId };
}

/**
 * Poll messages from queue (Batch up to maxMessages)
 */
async function receiveFromQueue(maxMessages = 10) {
  if (sqsClient && sqsQueueUrl) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: sqsQueueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 1
      });
      const response = await sqsClient.send(command);
      if (response.Messages && response.Messages.length > 0) {
        return response.Messages.map(m => ({
          messageId: m.MessageId,
          body: m.Body,
          receiptHandle: m.ReceiptHandle
        }));
      }
      return [];
    } catch (err) {
      console.warn(`[Queue] SQS Receive failed: ${err.message}`);
    }
  }

  // In-memory queue: pop up to maxMessages
  const messages = inMemoryQueue.splice(0, maxMessages);
  return messages;
}

/**
 * Delete message from queue after processing
 */
async function deleteFromQueue(receiptHandle) {
  if (sqsClient && sqsQueueUrl) {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: sqsQueueUrl,
        ReceiptHandle: receiptHandle
      });
      await sqsClient.send(command);
      return true;
    } catch (err) {
      console.warn(`[Queue] SQS Delete failed: ${err.message}`);
    }
  }

  return true; // Already removed from in-memory array
}

module.exports = {
  initQueue,
  sendToQueue,
  receiveFromQueue,
  deleteFromQueue,
  _inMemoryQueue: inMemoryQueue
};
