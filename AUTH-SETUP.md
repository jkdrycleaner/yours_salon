# Employee and administrator sign-in

Google/Gmail sign-in and email password reset are disabled. Employees sign in with their User ID and password. New employees and imported employee rows without an existing password use `1234` as their initial password and must change it at first sign-in. Passwords are stored as bcrypt hashes, and changing an employee's mobile number does not change an existing password.

Employees can change their password on first sign-in or from **My dashboard → Password & security**. Email address is optional employee information and is not used for sign-in or password resets.

Employee spreadsheet imports and templates require **Employee ID**, **Employee Name**, **Mobile Number**, and **User ID**. Email address is optional. A new imported employee receives the initial password `1234` and must change it at first sign-in. Re-importing an existing employee does not replace their existing password.

On first run, open the app on the server computer at `http://localhost:5000`. The login page offers a one-time administrator setup protected to localhost. Choose a User ID and a password of at least 12 characters; the password is stored as a bcrypt hash. This setup is disabled once an administrator exists.

Alternatively, configure the first administrator locally in the project's `.env` file. Do not send or commit these values:

```env
ADMIN_USER_ID=choose-an-admin-user-id
ADMIN_PASSWORD=replace-with-a-unique-password-of-at-least-12-characters
SESSION_SECRET=replace-with-a-long-random-secret
```

Keep `SESSION_SECRET` stable between server restarts so active sessions remain valid. After editing `.env`, restart the app with `npm start`. The administrator signs in using `ADMIN_USER_ID` and `ADMIN_PASSWORD`.

To change the administrator login from the app, sign in and open **Admin Data → Administrator login**. Enter the current password, a new User ID, and a new password of at least 12 characters twice. This saves an administrator credential in MongoDB and takes precedence over the bootstrap administrator values in `.env`; subsequent sign-ins use the saved credentials. Existing administrator sessions are invalidated when credentials are changed, except for the session receiving the new token.

Each employee can use either a collection percentage or a fixed monthly salary. The dashboard calculates net payable as earned salary minus employee expenses and salary payments for the selected month, with a minimum of zero.

## If MongoDB Atlas does not connect

The app retries failed initial Atlas connections with a bounded exponential backoff (up to 60 seconds), and retries after a later disconnection. This does not bypass Atlas access controls.

1. In MongoDB Atlas, open the project and confirm the cluster is running (not paused).
2. Open **Security → Network Access → Add IP Address → Add Current IP Address**. Add the public IP of the computer/network running this Node server, then save and wait for the rule to become active.
3. Do not use `0.0.0.0/0` for a public deployment. If the server's public IP changes, update the allowlist.
4. Under **Security → Database Access**, confirm the database user in `MASTER_MONGO_URI` is active and has the required database permissions.
5. Restart the app with `npm start`. Check `http://localhost:5000/health`; it returns HTTP 200 only when MongoDB is connected (otherwise HTTP 503).

If Atlas allowlisting and the database user are correct but the health check remains unavailable, check whether the Atlas cluster is paused or experiencing an outage. Never share the MongoDB URI, database password, or administrator password.
