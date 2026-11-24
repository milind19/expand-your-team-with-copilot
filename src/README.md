# Mergington High School Activities

A super simple website application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Sign up for activities
- Share any activity through WhatsApp, Facebook, or X, or copy its link without logging in

Sharing links open the website and highlight the chosen activity. If your browser
cannot copy a link automatically, a selected link appears for you to copy manually.
Only the activity name and public website link are shared, not participant details.
Friends need access to the website address you share; a localhost address only works
on your own computer.

## Development Guide

For detailed setup and development instructions, please refer to our [Development Guide](../docs/how-to-develop.md).

To check social sharing behavior, run `node --test tests/social-sharing.test.js`
from the repository root using Node.js 18 or later. No extra packages are needed.
