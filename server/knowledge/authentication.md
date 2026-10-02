# Authentication & User Security

## Overview
PaintCorp ERP implements secure JWT-based authentication for user access and API protection.

## Security Features
- **Passwords**: Encrypted using `bcryptjs` with 10 salt rounds before storage in the `users` table.
- **JWT Tokens**: Signed with `JWT_SECRET`, expiring after 24 hours. Tokens are stored in browser `sessionStorage` under `auth_token`.
- **Protected Routes**: React router validates auth state before granting access to ERP pages.
- **API Middleware**: Express backend uses `authMiddleware` to verify `Authorization: Bearer <token>` on all sensitive endpoints.
- **Rate Limiting**: Rate limiter restricts requests to 100 per 15-minute window to prevent brute force attacks.
- **Password Reset**: Secure email-based OTP (One-Time Password) system expiring in 10 minutes with maximum attempt limits.
- **User Roles**: Admin and Staff roles with role-based permissions.
