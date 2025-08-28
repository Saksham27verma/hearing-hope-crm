# Hearing Hope CRM & Inventory Management System

A comprehensive application for managing customers, inventory, sales, and billing for Hearing Hope, a hearing aid provider with multiple branches.

## Features

- **User Authentication**: Secure login system with role-based access control
- **Dashboard**: Overview of key metrics with recent activities
- **Product Management**: Track hearing aids and accessories inventory
- **Party Management**: Manage supplier information and transactions
- **Visitor Management (CRM)**: Track potential customers and follow-ups
- **Stock Management**: 
  - Product In (Purchases)
  - Product Out (Sales)
  - Delivery Challans
  - Stock Transfer between branches
- **Billing & Invoicing**: Generate and manage invoices and receipts
- **Reports**: Comprehensive reporting for business analytics
- **Multi-branch Support**: Manage inventory across multiple locations

## Technology Stack

- **Frontend**: Next.js, React, Material-UI
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Deployment**: Vercel (or your preferred hosting)

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/hearing-hope-crm.git
   cd hearing-hope-crm
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file in the root directory with your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

```
hearing-hope-crm/
├── public/                  # Static files
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── api/             # API routes
│   │   ├── dashboard/       # Dashboard page
│   │   ├── login/           # Login page
│   │   ├── products/        # Product management
│   │   ├── parties/         # Party management
│   │   ├── visitors/        # Visitor management
│   │   ├── sales/           # Sales management
│   │   ├── purchases/       # Purchase management
│   │   ├── reports/         # Reports
│   │   └── layout.tsx       # Root layout
│   ├── components/          # Reusable components
│   │   ├── common/          # Common UI components
│   │   └── Layout/          # Layout components
│   ├── firebase/            # Firebase configuration
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Utility functions
│   └── types/               # TypeScript types
├── .env.local               # Environment variables
├── next.config.js           # Next.js configuration
├── package.json             # Project dependencies
└── tsconfig.json            # TypeScript configuration
```

## Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password)
3. Create Firestore Database
4. Set up Firestore Security Rules (example in `firestore.rules`)
5. Set up Storage Rules for file uploads (invoices, etc.)

## Deployment

1. Build the application:
   ```
   npm run build
   ```

2. Deploy to Vercel:
   ```
   vercel
   ```
   
   Or your preferred hosting platform.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Material-UI](https://mui.com/)
- [Firebase](https://firebase.google.com/)
- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)

## Support

For support, email support@example.com or open an issue in the GitHub repository.
