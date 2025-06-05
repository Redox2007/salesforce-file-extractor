# Salesforce File Extractor

A powerful web-based tool for extracting, querying, and downloading files from Salesforce using SOQL queries. Built with React and designed for easy deployment via GitHub Pages.


![Salesforce File Extractor Interface](https://i.imgur.com/Kg3KeHX.png)

## 🚀 Quick Start

### Step 1: Install the Managed Package

**Production/Developer Orgs:**
```
https://login.salesforce.com/packaging/installPackage.apexp?p0=04tgL0000002Xcd
```

**Sandbox Orgs:**
```
https://test.salesforce.com/packaging/installPackage.apexp?p0=04tgL0000002Xcd
```

### Step 2: Access the Application

After installing the package, visit the web application:
```
https://redox2007.github.io/salesforce-file-extractor/
```

## 📋 Prerequisites

- Salesforce org with the managed package installed
- System Administrator or equivalent permissions
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🛠️ Configuration

### Required Setup

1. **Install the AppExchange Package First**
   - Use the installation links above to install the managed package in your Salesforce org
   - The package includes a pre-configured Connected App with OAuth settings
   - No manual Connected App setup is required

2. **Access the Web Application**
   - Navigate to: `https://redox2007.github.io/salesforce-file-extractor/`
   - Click "Connect to Salesforce"
   - Login with your Salesforce credentials
   - Grant permissions when prompted



## 📖 Usage

### Basic Workflow

1. **Connect to Salesforce**
   - Click "Connect to Salesforce" button
   - Login with your org credentials
   - Application will authenticate automatically

2. **Build SOQL Queries**
   - Use the Query Builder for common file queries
   - Or write custom SOQL queries in the text area
   - Preview results before downloading

3. **Download Files**
   - Execute queries to see file metadata
   - Select individual files for download
   - Use bulk download for multiple files
   - Files are organized in folders by date/type

### Sample Queries

**All Files (Limited):**
```sql
SELECT Id, Title, FileExtension, ContentSize, CreatedDate 
FROM ContentDocument 
LIMIT 50
```

**Files by Type:**
```sql
SELECT Id, Title, FileExtension, ContentSize, CreatedDate 
FROM ContentDocument 
WHERE FileExtension = 'pdf'
LIMIT 100
```

**Files by Date Range:**
```sql
SELECT Id, Title, FileExtension, ContentSize, CreatedDate 
FROM ContentDocument 
WHERE CreatedDate >= 2024-01-01T00:00:00Z 
AND CreatedDate <= 2024-12-31T23:59:59Z
LIMIT 200
```

**Large Files:**
```sql
SELECT Id, Title, FileExtension, ContentSize, CreatedDate 
FROM ContentDocument 
WHERE ContentSize > 1000000
ORDER BY ContentSize DESC
LIMIT 50
```

### Advanced Features

- **Progress Tracking**: Real-time progress bars for bulk operations
- **CORS Proxy Support**: Automatic fallback for API access
- **Smart Folder Organization**: Files organized by date and type
- **Bulk Download**: Download multiple files with progress tracking
- **Query History**: Save and reuse common queries
- **File Filtering**: Filter results by size, type, or date

## 🔧 Troubleshooting

### Common Issues

**"Cannot connect to Salesforce"**
- Ensure the managed package is installed
- Check that you're using the correct org URL (production vs sandbox)
- Verify your user has appropriate permissions

**"CORS Error"**
- Enable the CORS proxy in the application settings
- Or configure CORS in your Salesforce org (Setup → CORS)

**"No files found"**
- Check your SOQL query syntax
- Verify you have access to ContentDocument object
- Ensure there are files matching your query criteria

**"Download failed"**
- Check your network connection
- Verify file permissions in Salesforce
- Try downloading smaller batches

### Support

For issues related to:
- **Package Installation**: Contact Salesforce Support
- **Application Usage**: Create an issue on the GitHub repository
- **Feature Requests**: Submit a pull request or feature request

## 🔒 Security & Permissions

### Required Salesforce Permissions

- Read access to ContentDocument object
- Read access to ContentVersion object  
- API access enabled
- OAuth permissions for the Connected App

### Data Privacy

- No data is stored by the web application
- All authentication uses OAuth 2.0 standard
- Files are downloaded directly from Salesforce to your browser
- No third-party data collection

## 📱 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🆕 What's New

### Latest Version Features

- Simplified installation with managed package
- Automatic OAuth configuration
- Enhanced CORS proxy support
- Improved bulk download performance
- Better error handling and user feedback

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: Check this README for common questions
- **Community**: Join discussions in the Issues section
