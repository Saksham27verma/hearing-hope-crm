# Hearing Hope CRM API Documentation

This document outlines the API endpoints available for the Hearing Hope mobile application to interact with the CRM system.

## Base URL

All API endpoints are relative to:

```
https://api.hearinghope.com/v1
```

## Authentication

### Login

Authenticates a user and returns a JWT token.

```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user123",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

### Refresh Token

Refreshes an expired JWT token.

```
POST /auth/refresh
```

**Request Headers:**
```
Authorization: Bearer {refresh_token}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Enquiries

### List Enquiries

Returns a paginated list of enquiries.

```
GET /enquiries
```

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20): Number of results per page
- `status` (string, optional): Filter by status ('new', 'in-progress', 'resolved', 'closed')
- `type` (string, optional): Filter by enquiry type
- `search` (string, optional): Search by name, phone, or email
- `sortBy` (string, default: 'createdAt'): Field to sort by
- `sortOrder` (string, default: 'desc'): Sort order ('asc' or 'desc')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "enq123",
      "name": "John Smith",
      "phone": "+1234567890",
      "email": "john@example.com",
      "subject": "Hearing Test Enquiry",
      "status": "new",
      "enquiryType": "test",
      "createdAt": "2023-06-15T10:30:00Z",
      "updatedAt": "2023-06-15T10:30:00Z"
    }
    // More enquiries...
  ],
  "pagination": {
    "total": 45,
    "pages": 3,
    "page": 1,
    "limit": 20,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Get Enquiry Details

Returns detailed information for a specific enquiry.

```
GET /enquiries/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "enq123",
    "name": "John Smith",
    "phone": "+1234567890",
    "email": "john@example.com",
    "address": "123 Main St, Anytown, CA",
    "reference": "Website",
    "subject": "Hearing Test Enquiry",
    "message": "I would like to schedule a hearing test.",
    "status": "new",
    "enquiryType": "test",
    "testDetails": {
      "testName": "PTA",
      "testDoneBy": "Dr. Jane",
      "testDate": "2023-06-20",
      "testResults": "Mild hearing loss in left ear",
      "recommendations": "Suggested hearing aid trial"
    },
    "visits": [
      {
        "id": "visit123",
        "date": "2023-06-20",
        "status": "completed",
        "visitType": "test",
        "activeFormTypes": ["test", "trial"],
        "notes": "Patient arrived on time",
        "testDetails": {
          "testName": "PTA",
          "testDoneBy": "Dr. Jane",
          "testResults": "Mild hearing loss in left ear"
        },
        "trialDetails": {
          "trialDevice": "Phonak Audéo",
          "trialDuration": "1 week",
          "trialFeedback": "Patient reported improved hearing"
        },
        "recommendations": "Recommended Phonak Audéo hearing aid",
        "createdAt": "2023-06-20T11:00:00Z"
      }
    ],
    "followUps": [
      {
        "id": "followup123",
        "date": "2023-06-25",
        "remarks": "Called to check on trial experience",
        "nextFollowUpDate": "2023-07-02",
        "callerName": "Sarah",
        "createdAt": "2023-06-25T14:30:00Z"
      }
    ],
    "createdAt": "2023-06-15T10:30:00Z",
    "updatedAt": "2023-06-25T14:30:00Z"
  }
}
```

### Create Enquiry

Creates a new enquiry.

```
POST /enquiries
```

**Request Body:**
```json
{
  "name": "John Smith",
  "phone": "+1234567890",
  "email": "john@example.com",
  "address": "123 Main St, Anytown, CA",
  "reference": "Website",
  "subject": "Hearing Test Enquiry",
  "message": "I would like to schedule a hearing test.",
  "status": "new",
  "enquiryType": "test",
  "testDetails": {
    "testName": "PTA",
    "testDoneBy": "Dr. Jane",
    "testDate": "2023-06-20",
    "testResults": "Mild hearing loss in left ear",
    "recommendations": "Suggested hearing aid trial"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "enq123",
    "name": "John Smith",
    "phone": "+1234567890",
    "email": "john@example.com",
    "address": "123 Main St, Anytown, CA",
    "reference": "Website",
    "subject": "Hearing Test Enquiry",
    "message": "I would like to schedule a hearing test.",
    "status": "new",
    "enquiryType": "test",
    "testDetails": {
      "testName": "PTA",
      "testDoneBy": "Dr. Jane",
      "testDate": "2023-06-20",
      "testResults": "Mild hearing loss in left ear",
      "recommendations": "Suggested hearing aid trial"
    },
    "visits": [],
    "followUps": [],
    "createdAt": "2023-06-15T10:30:00Z",
    "updatedAt": "2023-06-15T10:30:00Z"
  }
}
```

### Update Enquiry

Updates an existing enquiry.

```
PUT /enquiries/{id}
```

**Request Body:**
Same format as Create Enquiry, but only include the fields you want to update.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "enq123",
    "name": "John Smith",
    "phone": "+1234567890",
    "email": "john@example.com",
    "address": "123 Main St, Anytown, CA",
    "reference": "Website",
    "subject": "Hearing Test Enquiry Updated",
    "message": "I would like to schedule a comprehensive hearing test.",
    "status": "in-progress",
    "enquiryType": "test",
    "testDetails": {
      "testName": "PTA",
      "testDoneBy": "Dr. Jane",
      "testDate": "2023-06-20",
      "testResults": "Mild hearing loss in left ear",
      "recommendations": "Suggested hearing aid trial"
    },
    "createdAt": "2023-06-15T10:30:00Z",
    "updatedAt": "2023-06-16T14:45:00Z"
  }
}
```

### Delete Enquiry

Deletes an enquiry.

```
DELETE /enquiries/{id}
```

**Response:**
```json
{
  "success": true,
  "message": "Enquiry deleted successfully"
}
```

## Visits

### Add Visit to Enquiry

Adds a new visit to an enquiry.

```
POST /enquiries/{enquiryId}/visits
```

**Request Body:**
```json
{
  "date": "2023-07-05",
  "status": "scheduled",
  "visitType": "test",
  "activeFormTypes": ["test", "trial"],
  "notes": "Follow-up visit for hearing test",
  "testDetails": {
    "testName": "PTA",
    "testDoneBy": "Dr. Jane",
    "testResults": "Mild hearing loss in left ear"
  },
  "trialDetails": {
    "trialDevice": "Phonak Audéo",
    "trialDuration": "2 weeks",
    "trialFeedback": ""
  },
  "recommendations": ""
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "visit456",
    "date": "2023-07-05",
    "status": "scheduled",
    "visitType": "test",
    "activeFormTypes": ["test", "trial"],
    "notes": "Follow-up visit for hearing test",
    "testDetails": {
      "testName": "PTA",
      "testDoneBy": "Dr. Jane",
      "testResults": "Mild hearing loss in left ear"
    },
    "trialDetails": {
      "trialDevice": "Phonak Audéo",
      "trialDuration": "2 weeks",
      "trialFeedback": ""
    },
    "recommendations": "",
    "createdAt": "2023-07-01T09:15:00Z"
  }
}
```

### Update Visit

Updates an existing visit.

```
PUT /enquiries/{enquiryId}/visits/{visitId}
```

**Request Body:**
Same format as Add Visit, but only include fields you want to update.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "visit456",
    "date": "2023-07-05",
    "status": "completed",
    "visitType": "test",
    "activeFormTypes": ["test", "trial"],
    "notes": "Follow-up visit for hearing test",
    "testDetails": {
      "testName": "PTA",
      "testDoneBy": "Dr. Jane",
      "testResults": "Mild hearing loss in left ear"
    },
    "trialDetails": {
      "trialDevice": "Phonak Audéo",
      "trialDuration": "2 weeks",
      "trialFeedback": "Patient reported significant improvement"
    },
    "recommendations": "Recommend purchase of Phonak Audéo",
    "createdAt": "2023-07-01T09:15:00Z",
    "updatedAt": "2023-07-05T14:30:00Z"
  }
}
```

### Delete Visit

Deletes a visit.

```
DELETE /enquiries/{enquiryId}/visits/{visitId}
```

**Response:**
```json
{
  "success": true,
  "message": "Visit deleted successfully"
}
```

## Follow-ups

### Add Follow-up to Enquiry

Adds a new follow-up to an enquiry.

```
POST /enquiries/{enquiryId}/followups
```

**Request Body:**
```json
{
  "date": "2023-07-10",
  "remarks": "Called to check on hearing aid experience",
  "nextFollowUpDate": "2023-07-20",
  "callerName": "Sarah"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "followup456",
    "date": "2023-07-10",
    "remarks": "Called to check on hearing aid experience",
    "nextFollowUpDate": "2023-07-20",
    "callerName": "Sarah",
    "createdAt": "2023-07-10T11:25:00Z"
  }
}
```

### Update Follow-up

Updates an existing follow-up.

```
PUT /enquiries/{enquiryId}/followups/{followupId}
```

**Request Body:**
Same format as Add Follow-up, but only include fields you want to update.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "followup456",
    "date": "2023-07-10",
    "remarks": "Called to check on hearing aid experience. Patient very satisfied.",
    "nextFollowUpDate": "2023-08-10",
    "callerName": "Sarah",
    "createdAt": "2023-07-10T11:25:00Z",
    "updatedAt": "2023-07-10T11:45:00Z"
  }
}
```

### Delete Follow-up

Deletes a follow-up.

```
DELETE /enquiries/{enquiryId}/followups/{followupId}
```

**Response:**
```json
{
  "success": true,
  "message": "Follow-up deleted successfully"
}
```

## Visitors

### List Visitors

Returns a paginated list of visitors.

```
GET /visitors
```

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20): Number of results per page
- `date` (string, optional): Filter by visit date (YYYY-MM-DD)
- `search` (string, optional): Search by name, phone, or email
- `sortBy` (string, default: 'createdAt'): Field to sort by
- `sortOrder` (string, default: 'desc'): Sort order ('asc' or 'desc')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "visitor123",
      "name": "John Smith",
      "phone": "+1234567890",
      "email": "john@example.com",
      "reasonOfVisit": "Visit for Hearing Test",
      "visitDate": "2023-07-15",
      "visitTime": "10:30",
      "visitingCenter": "main",
      "remarks": "First-time visitor",
      "relatedEnquiryId": "enq123",
      "createdAt": "2023-07-15T10:30:00Z"
    }
    // More visitors...
  ],
  "pagination": {
    "total": 30,
    "pages": 2,
    "page": 1,
    "limit": 20,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Create Visitor

Creates a new visitor entry.

```
POST /visitors
```

**Request Body:**
```json
{
  "name": "Jane Doe",
  "phone": "+1987654321",
  "email": "jane@example.com",
  "reasonOfVisit": "Visit for Impedance Test",
  "visitDate": "2023-07-18",
  "visitTime": "14:00",
  "visitingCenter": "branch1",
  "remarks": "Walk-in visitor",
  "relatedEnquiryId": "enq456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "visitor456",
    "name": "Jane Doe",
    "phone": "+1987654321",
    "email": "jane@example.com",
    "reasonOfVisit": "Visit for Impedance Test",
    "visitDate": "2023-07-18",
    "visitTime": "14:00",
    "visitingCenter": "branch1",
    "remarks": "Walk-in visitor",
    "relatedEnquiryId": "enq456",
    "createdAt": "2023-07-16T09:45:00Z"
  }
}
```

## Error Handling

All API endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {
      "id": "enq999"
    }
  }
}
```

Common error codes:
- `INVALID_CREDENTIALS`: Authentication failed
- `UNAUTHORIZED`: User not authorized to perform action
- `VALIDATION_ERROR`: Request validation failed
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `DUPLICATE_ENTRY`: Resource already exists
- `SERVER_ERROR`: Internal server error

## Pagination

All list endpoints support pagination with the following query parameters:
- `page`: Page number (starting from 1)
- `limit`: Number of items per page

Response includes pagination metadata:
```json
"pagination": {
  "total": 45,    // Total number of items
  "pages": 3,     // Total number of pages
  "page": 1,      // Current page
  "limit": 20,    // Items per page
  "hasNext": true, // Has next page
  "hasPrev": false // Has previous page
}
```

## API Versioning

The API is versioned in the URL path (e.g., `/v1/enquiries`). When breaking changes are introduced, a new version will be released (e.g., `/v2/enquiries`).

## Rate Limiting

To prevent abuse, the API implements rate limiting:
- 100 requests per minute per IP address
- 1000 requests per hour per authenticated user

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1603908567
```

## API Status

Check the API status:

```
GET /status
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 1234567
}
``` 