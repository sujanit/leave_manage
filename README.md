<<<<<<< HEAD
# Leave Management System

## Requirements
- Node.js (LTS recommended)
- MongoDB Community Server running locally, OR a MongoDB Atlas connection string

## Run on Windows 11
1. Extract this ZIP to a folder, for example `C:\\Users\\YourName\\Downloads\\leave-management-system`.
2. Open that folder in VS Code.
3. Ensure MongoDB is running locally. The default database URL is `mongodb://127.0.0.1:27017/leave_management`.
4. Copy `.env.example` to a new file named `.env`. If you use MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string.
5. In VS Code, open Terminal > New Terminal.
6. Run:
   ```powershell
   npm install
   npm start
   ```
7. Wait for `MongoDB connected` and `Server running at http://localhost:5000`.
8. Open `http://localhost:5000` in Chrome.

## Files
- `server.js` — Express API and MongoDB models/routes
- `public/index.html` — registration, login and dashboard screens
- `public/style.css` — styling
- `public/app.js` — frontend behavior and API calls
- `.env.example` — example configuration
- `package.json` — dependencies and commands

## Demo flow
1. Register a user with a unique email and roll number.
2. Log in using that email and roll number.
3. Apply for Casual or Medical leave. The available balance is reduced when the application is submitted.
4. Use Refresh Balance to fetch the latest balance; Logout returns to the login screen.

## Important notes
- This is an educational demo. It uses email + roll number as a simple login and does not include passwords or production-grade authentication. Do not use real private data.
- Leave balance is deducted when a request is submitted, regardless of approval status. A production version should normally deduct or reserve leave only according to its approval policy and restore it if rejected.
- This starter does not include an administrator approval screen.
=======
# LEAVE-MANAGE
>>>>>>> c49754bb83af66bb4ec99880c72de702fe7c1547
