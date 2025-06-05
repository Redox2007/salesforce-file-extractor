# Salesforce File Extractor

A powerful web application for extracting files from Salesforce using custom SOQL queries with unlimited pagination and bulk download capabilities.

## 🚀 Features

- **Unlimited SOQL Queries**: No 2000 record limits with automatic pagination
- **Massive File Downloads**: Support for 500k+ files with smart batching
- **OAuth2 Authentication**: Secure connection to Salesforce orgs
- **Universal Compatibility**: Works with Production, Sandbox, and Developer orgs
- **Smart Folder Organization**: Direct downloads to selected folders
- **Real-time Progress Tracking**: Visual indicators and time estimates
- **CORS Proxy Support**: Fallback for restrictive environments

## 🌐 Live Demo

**GitHub Pages:** https://[YOUR-USERNAME].github.io/salesforce-file-extractor/

## 🛠️ Local Development

### Prerequisites

- Node.js 16+ and npm
- Salesforce org with appropriate permissions

### Setup

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/[YOUR-USERNAME]/salesforce-file-extractor.git
   cd salesforce-file-extractor
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Start development server:
   \`\`\`bash
   npm start
   \`\`\`

4. Open http://localhost:3000

### Build for Production

\`\`\`bash
npm run build
\`\`\`

## 📦 Salesforce Setup

### Option 1: Use Managed Package (Recommended)

Install our 2GP managed package that includes Connected App and CORS settings:

- **Package ID:** [YOUR-PACKAGE-ID]
- **Installation URL:** [YOUR-INSTALLATION-URL]

### Option 2: Manual Setup

1. **Create Connected App:**

   - Setup → App Manager → New Connected App
   - Enable OAuth Settings
   - Add callback URLs: https://[YOUR-USERNAME].github.io/salesforce-file-extractor/
   - Scopes: API, Refresh Token

2. **Configure CORS:**

   - Setup → CORS → New
   - Origin URL: https://[YOUR-USERNAME].github.io

3. **Update Consumer Key:**
   - Copy Consumer Key from Connected App
   - Update in the File Extractor configuration

## 🔧 Configuration

The app uses a configurable Consumer Key approach. After deployment:

1. Install the Salesforce package or set up Connected App manually
2. Copy the Consumer Key from Setup → App Manager → [Connected App] → View
3. Enter the Consumer Key in the app's configuration section

## 📋 Usage

1. **Connect**: Enter Consumer Key and login to Salesforce
2. **Query**: Write SOQL to find files (automatic pagination handles large results)
3. **Select**: Choose files individually or select all
4. **Download**: Individual downloads or bulk processing with progress tracking

## 🎯 Example SOQL Queries

\`\`\`sql
-- Recent files
SELECT Id, Title, FileExtension, ContentSize FROM ContentDocument
WHERE CreatedDate = LAST_N_DAYS:7 LIMIT 50

-- Large files
SELECT Id, Title FROM ContentDocument
WHERE ContentSize > 1000000 ORDER BY ContentSize DESC

-- Attachments by object type
SELECT Id, Name, ContentType FROM Attachment
WHERE Parent.Type = 'Account' LIMIT 100
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: \`git checkout -b feature/amazing-feature\`
3. Commit changes: \`git commit -m 'Add amazing feature'\`
4. Push to branch: \`git push origin feature/amazing-feature\`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: https://github.com/[YOUR-USERNAME]/salesforce-file-extractor/issues
- **Discussions**: https://github.com/[YOUR-USERNAME]/salesforce-file-extractor/discussions
- **Documentation**: See README and code comments

## 🙏 Acknowledgments

- Built with React and modern web technologies
- Salesforce REST API integration
- Lucide React icons
- Community feedback and contributions
