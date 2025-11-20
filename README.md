# File Uploader Application

A secure file upload and management system built with Express.js, Prisma, and PostgreSQL.

## Features

- 📁 **File Upload**: Upload files with drag-and-drop support
- 🔐 **User Authentication**: Simple email-based authentication
- 📂 **File Management**: View, download, and delete uploaded files
- 🌐 **Public/Private Files**: Control file visibility
- 💾 **Database Storage**: File metadata stored in PostgreSQL
- 📏 **File Validation**: Size limits and type restrictions
- 🎨 **Responsive UI**: Bootstrap-based responsive design

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **File Upload**: Multer
- **Templates**: EJS
- **Styling**: Bootstrap 5, Font Awesome
- **Session Management**: Express Session with Prisma Session Store

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd file-uploader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/file_uploader?schema=public"
   SESSION_SECRET="your-secret-session-key"
   PORT=3000
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   ```

5. **Start the application**
   ```bash
   # Development mode (with nodemon)
   npm run dev
   
   # Production mode
   npm start
   ```

## Usage

1. **Register/Login**: Create an account or log in with existing credentials
2. **Upload Files**: Navigate to the upload page and select files to upload
3. **Manage Files**: View all your files, download them, or delete them
4. **Public Files**: Mark files as public to allow anyone to download them

## File Upload Specifications

- **Maximum file size**: 10MB
- **Supported formats**: JPEG, PNG, GIF, PDF, DOC, DOCX, TXT, ZIP
- **Storage location**: `/uploads` directory
- **Naming**: Files are automatically renamed to prevent conflicts

## API Endpoints

### Authentication
- `GET /users/login` - Show login form
- `POST /users/login` - Handle login
- `GET /users/register` - Show registration form
- `POST /users/register` - Handle registration
- `POST /users/logout` - Handle logout

### File Management
- `GET /files` - List user's files
- `GET /files/upload` - Show upload form
- `POST /files/upload` - Handle file upload
- `GET /files/:id/download` - Download a file
- `DELETE /files/:id` - Delete a file

## Database Schema

The application uses three main models:

- **User**: Stores user information (id, email, name)
- **File**: Stores file metadata (filename, size, path, etc.)
- **Session**: Manages user sessions

## Security Features

- File type validation
- File size limits
- User authentication required for uploads
- Private files accessible only to owners
- Session-based authentication

## Development

### Database Management

```bash
# View database in Prisma Studio
npm run db:studio

# Reset database (development only)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy
```

### Adding New File Types

To add support for new file types, update the `fileFilter` function in `/routes/files.js`:

```javascript
const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|newtype/;
```

## Directory Structure

```
file-uploader/
├── app.js              # Express application setup
├── server.js           # Server entry point
├── package.json        # Dependencies and scripts
├── prisma/
│   └── schema.prisma   # Database schema
├── routes/
│   ├── files.js        # File management routes
│   └── users.js        # User authentication routes
├── views/
│   ├── layout.ejs      # Main layout template
│   ├── index.ejs       # Home page
│   ├── files/          # File-related templates
│   └── users/          # User-related templates
├── uploads/            # File storage directory
└── public/             # Static assets
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.
