import React, { useState, useEffect } from "react";
import {
  Download,
  Database,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader,
  ExternalLink,
  LogOut,
  FileText,
  Image,
  File,
  Code,
  Play,
  FolderOpen,
  Folder,
  Activity,
  Check,
  X,
} from "lucide-react";

const App = () => {
  // Salesforce connection state
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [instanceType, setInstanceType] = useState("production");
  const [userInfo, setUserInfo] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");

  // Files and selection state
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());
  const [downloadProgress, setDownloadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [error, setError] = useState("");

  // File download status tracking
  const [fileDownloadStatus, setFileDownloadStatus] = useState(new Map());

  // SOQL Query state
  const [soqlQuery, setSoqlQuery] = useState("");
  const [soqlError, setSoqlError] = useState("");
  const [queryValidation, setQueryValidation] = useState({
    isValid: null,
    message: "",
  });

  // Folder selection state
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderSupported, setFolderSupported] = useState(false);

  // CORS proxy configuration
  const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";
  const [useProxy, setUseProxy] = useState(false);

  // OAuth popup fallback
  const [usePopup, setUsePopup] = useState(false);
  const [popupWindow, setPopupWindow] = useState(null);

  // Check for folder API support
  useEffect(() => {
    setFolderSupported("showDirectoryPicker" in window);
  }, []);

  // Set default SOQL query
  useEffect(() => {
    if (!soqlQuery) {
      setSoqlQuery(`SELECT Id, Title, FileExtension, ContentSize, CreatedDate, CreatedBy.Name, LastModifiedDate 
FROM ContentDocument 
WHERE CreatedDate = LAST_N_DAYS:30 
ORDER BY LastModifiedDate DESC 
LIMIT 50`);
    }
  }, []);

  // Validate SOQL query
  useEffect(() => {
    if (soqlQuery.trim()) {
      const isValidBasic =
        soqlQuery.trim().toLowerCase().startsWith("select") &&
        soqlQuery.toLowerCase().includes("from");

      if (isValidBasic) {
        setQueryValidation({
          isValid: true,
          message: "Query syntax appears valid",
        });
      } else {
        setQueryValidation({
          isValid: false,
          message: "Query must start with SELECT and include FROM",
        });
      }
    } else {
      setQueryValidation({ isValid: null, message: "" });
    }
  }, [soqlQuery]);

  // Enhanced fetch with CORS handling
  const safeFetch = async (url, options = {}) => {
    const finalUrl = useProxy ? `${CORS_PROXY}${url}` : url;

    try {
      return await fetch(finalUrl, {
        ...options,
        headers: {
          ...options.headers,
          ...(useProxy && { "X-Requested-With": "XMLHttpRequest" }),
        },
      });
    } catch (error) {
      if (error.message.includes("CORS") && !useProxy) {
        console.log("CORS error detected, suggesting proxy use");
        throw new Error("CORS_ERROR");
      }
      throw error;
    }
  };

  const handleMainLogout = () => {
    logout();
  };

  // Check for OAuth callback
  useEffect(() => {
    const checkOAuthCallback = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);

      const accessToken = hashParams.get("access_token");
      const instanceUrl = hashParams.get("instance_url");
      const error = hashParams.get("error");
      const authError = urlParams.get("error");

      if (error || authError) {
        setError(`OAuth Error: ${error || authError}`);
        setConnectionStatus("error");
        return;
      }

      if (accessToken && instanceUrl) {
        handleSuccessfulAuth(accessToken, instanceUrl);
      }
    };

    checkOAuthCallback();

    // Listen for popup messages
    const handleMessage = (event) => {
      if (event.data && event.data.type === "SALESFORCE_AUTH") {
        if (event.data.error) {
          setError(`OAuth Error: ${event.data.error}`);
          setConnectionStatus("error");
        } else if (event.data.accessToken && event.data.instanceUrl) {
          handleSuccessfulAuth(event.data.accessToken, event.data.instanceUrl);
        }
        if (popupWindow) {
          popupWindow.close();
          setPopupWindow(null);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [popupWindow]);

  // Smart OAuth connection with popup fallback
  const connectToSalesforce = () => {
    const isProduction = instanceType === "production";
    const baseUrl = isProduction
      ? "https://login.salesforce.com"
      : "https://test.salesforce.com";

    // Smart redirect URI detection
    let redirectUri;
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      redirectUri = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    } else {
      redirectUri = window.location.href.split("?")[0].split("#")[0];
    }

    const authUrl =
      `${baseUrl}/services/oauth2/authorize?` +
      `response_type=token&` +
      `client_id=3MVG9dAEux2v1sLs2phMtumXVjrg_BN5TfF1KkvqpE.fnjFKuoairyUJzCrJpOKjtKqC62G80YUBgaoofvOh9` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=api%20refresh_token&` +
      `state=oauth&` +
      `prompt=login`;

    console.log("Connecting with redirect URI:", redirectUri);

    if (usePopup) {
      // Popup method
      const popup = window.open(
        authUrl,
        "salesforce_auth",
        "width=600,height=700,scrollbars=yes,resizable=yes"
      );
      setPopupWindow(popup);

      // Monitor popup
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setPopupWindow(null);
        }
      }, 1000);
    } else {
      // Direct redirect method
      localStorage.setItem("sf_auth_attempt", "true");
      localStorage.setItem("sf_instance_type", instanceType);
      window.location.href = authUrl;
    }
  };

  const handleSuccessfulAuth = async (token, instUrl) => {
    setConnectionStatus("connecting");
    setLoading(true);

    try {
      setAccessToken(token);
      setInstanceUrl(instUrl);

      await fetchUserInfo(token, instUrl);
      setConnectionStatus("connected");

      // Clean up URL and localStorage
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.removeItem("sf_auth_attempt");
      localStorage.removeItem("sf_instance_type");
    } catch (err) {
      setError(err.message);
      setConnectionStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserInfo = async (token, instUrl) => {
    try {
      const response = await fetch(`${instUrl}/services/oauth2/userinfo`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const userInfo = await response.json();
        setUserInfo(userInfo);
      }
    } catch (err) {
      console.warn("Could not fetch user info:", err.message);
    }
  };

  // Execute custom SOQL query with pagination support
  const executeCustomQuery = async () => {
    if (!soqlQuery.trim()) {
      setSoqlError("Please enter a SOQL query");
      return;
    }

    if (queryValidation.isValid === false) {
      setSoqlError(queryValidation.message);
      return;
    }

    if (!accessToken || !instanceUrl) {
      setSoqlError("Not authenticated. Please reconnect to Salesforce.");
      return;
    }

    setLoading(true);
    setError("");
    setSoqlError("");
    setFiles([]);
    setFileDownloadStatus(new Map()); // Reset download status

    console.log("Executing SOQL query with pagination:", soqlQuery);
    console.log("Using CORS proxy:", useProxy);

    try {
      let allRecords = [];
      let queryUrl = `${instanceUrl}/services/data/v58.0/query/?q=${encodeURIComponent(
        soqlQuery
      )}`;
      let pageCount = 0;
      const maxPages = 1000; // Safety limit to prevent infinite loops

      while (queryUrl && pageCount < maxPages) {
        pageCount++;

        // Update loading message with progress
        if (pageCount > 1) {
          setSoqlError(
            `📥 Fetching records... Page ${pageCount} (${allRecords.length.toLocaleString()} records so far)`
          );
        }

        const response = await safeFetch(queryUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

          try {
            const errorData = await response.json();
            if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData[0]?.message) {
              errorMessage = errorData[0].message;
            }
          } catch (parseError) {
            console.log("Could not parse error response:", parseError);
          }

          if (response.status === 401) {
            errorMessage =
              "Authentication expired. Please reconnect to Salesforce.";
            setConnectionStatus("disconnected");
          } else if (response.status === 403) {
            errorMessage =
              "Access denied. Check object permissions for this query.";
          } else if (response.status === 404) {
            errorMessage =
              "Invalid object or field in query. Check your SOQL syntax.";
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();
        const pageRecords = data.records || [];

        // Add this page's records to the total
        allRecords = [...allRecords, ...pageRecords];

        // Check if there are more pages
        if (data.nextRecordsUrl) {
          queryUrl = `${instanceUrl}${data.nextRecordsUrl}`;
          // Add a small delay to avoid overwhelming the API
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else {
          queryUrl = null; // No more pages
        }

        console.log(
          `Page ${pageCount}: ${pageRecords.length} records, Total: ${allRecords.length}`
        );
      }

      if (pageCount >= maxPages) {
        setSoqlError(
          `⚠️ Reached maximum page limit (${maxPages} pages). Consider adding more specific WHERE clauses to reduce result set.`
        );
      }

      setFiles(allRecords);
      setSelectedFiles(new Set());

      if (allRecords.length === 0) {
        setSoqlError("Query executed successfully but returned no records.");
      } else {
        setSoqlError(
          `✅ Query completed! Retrieved ${allRecords.length.toLocaleString()} records across ${pageCount} pages.`
        );
      }
    } catch (err) {
      console.error("SOQL Query Error:", err);

      if (err.message === "CORS_ERROR") {
        setSoqlError(`CORS Error: Direct browser requests to Salesforce are blocked for security. 

Solutions:
1. Enable CORS Proxy below and try again
2. Use browser extension to disable CORS (not recommended for production)
3. Deploy this app to a server with proper backend proxy`);
      } else {
        setSoqlError(`SOQL Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Folder selection
  const selectDownloadFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      setSelectedFolder(dirHandle);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(`Folder selection failed: ${err.message}`);
      }
    }
  };

  // Update download status helper
  const updateFileDownloadStatus = (fileId, status) => {
    setFileDownloadStatus((prev) => {
      const newMap = new Map(prev);
      newMap.set(fileId, status);
      return newMap;
    });
  };

  // Enhanced download function
  const downloadFile = async (file, showProgress = true) => {
    if (showProgress) {
      setDownloadingFiles((prev) => new Set([...prev, file.Id]));
    }

    updateFileDownloadStatus(file.Id, "downloading");

    try {
      let downloadUrl = "";
      let fileName = "";

      // Determine object type from query or file structure
      const queryLower = soqlQuery.toLowerCase();
      let objectType = "";

      if (queryLower.includes("from contentdocument")) {
        objectType = "ContentDocument";
      } else if (queryLower.includes("from attachment")) {
        objectType = "Attachment";
      } else if (queryLower.includes("from document")) {
        objectType = "Document";
      } else {
        // Try to detect from FROM clause
        const fromMatch = queryLower.match(/from\s+(\w+)/);
        if (fromMatch) {
          objectType = fromMatch[1];
        }
      }

      console.log("Detected object type:", objectType);

      if (objectType === "ContentDocument") {
        const versionResponse = await safeFetch(
          `${instanceUrl}/services/data/v58.0/query/?q=SELECT VersionData FROM ContentVersion WHERE ContentDocumentId='${file.Id}' AND IsLatest=true`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!versionResponse.ok) {
          throw new Error(
            `Failed to get version data: ${versionResponse.status}`
          );
        }

        const versionData = await versionResponse.json();
        if (versionData.records && versionData.records.length > 0) {
          downloadUrl = `${instanceUrl}${versionData.records[0].VersionData}`;
          fileName = `${file.Title || "file"}${
            file.FileExtension ? "." + file.FileExtension : ""
          }`;
        } else {
          throw new Error("No version data found for this ContentDocument");
        }
      } else if (objectType === "Attachment") {
        downloadUrl = `${instanceUrl}/services/data/v58.0/sobjects/Attachment/${file.Id}/Body`;
        fileName = file.Name || `attachment_${file.Id}`;
      } else if (objectType === "Document") {
        downloadUrl = `${instanceUrl}/services/data/v58.0/sobjects/Document/${file.Id}/Body`;
        fileName = file.Name || `document_${file.Id}`;
      } else {
        // Generic approach for unknown objects
        const possibleUrls = [
          `${instanceUrl}/services/data/v58.0/sobjects/${objectType}/${file.Id}/Body`,
          `${instanceUrl}/services/data/v58.0/sobjects/${objectType}/${file.Id}/VersionData`,
          `${instanceUrl}/services/data/v58.0/sobjects/${objectType}/${file.Id}/Data`,
        ];

        for (const testUrl of possibleUrls) {
          try {
            const testResponse = await safeFetch(testUrl, {
              method: "HEAD",
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (testResponse.ok) {
              downloadUrl = testUrl;
              fileName = file.Name || file.Title || `${objectType}_${file.Id}`;
              break;
            }
          } catch (err) {
            continue;
          }
        }

        if (!downloadUrl) {
          throw new Error(
            `Unable to download files from ${objectType}. Try querying ContentDocument, Attachment, or Document objects instead.`
          );
        }
      }

      const response = await safeFetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(
          `Download failed: ${response.status} - ${response.statusText}`
        );
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      // Use folder API if available and folder selected
      if (selectedFolder && folderSupported) {
        try {
          const fileHandle = await selectedFolder.getFileHandle(fileName, {
            create: true,
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (err) {
          console.warn("Folder write failed, falling back to download:", err);
          downloadToDownloadsFolder(blob, fileName);
        }
      } else {
        downloadToDownloadsFolder(blob, fileName);
      }

      updateFileDownloadStatus(file.Id, "success");
    } catch (err) {
      const errorMessage = `Error downloading ${
        file.Title || file.Name || file.Id
      }: ${err.message}`;
      console.error(errorMessage);
      updateFileDownloadStatus(file.Id, "error");
      if (showProgress) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (showProgress) {
        setDownloadingFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(file.Id);
          return newSet;
        });
      }
    }
  };

  const downloadToDownloadsFolder = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Bulk download for selected files only with enhanced batching
  const downloadSelectedFiles = async () => {
    const filesToDownload = files.filter((file) => selectedFiles.has(file.Id));

    if (filesToDownload.length === 0) {
      setError("No files selected for download");
      return;
    }

    // Show confirmation for large downloads
    if (filesToDownload.length > 10000) {
      const confirmLarge = window.confirm(
        `⚠️ You're about to download ${filesToDownload.length.toLocaleString()} files. This will take a very long time and may consume significant bandwidth and storage.\n\nThis operation cannot be easily stopped once started. Are you sure you want to continue?`
      );
      if (!confirmLarge) return;
    }

    setDownloadProgress({ current: 0, total: filesToDownload.length });
    setError("");

    // Adaptive batch sizing based on total files
    let DOWNLOAD_BATCH_SIZE = 3;
    if (filesToDownload.length > 50000) {
      DOWNLOAD_BATCH_SIZE = 5; // Larger batches for massive downloads
    } else if (filesToDownload.length > 10000) {
      DOWNLOAD_BATCH_SIZE = 4;
    }

    // Adaptive delays based on total files
    let BATCH_DELAY = 500;
    if (filesToDownload.length > 50000) {
      BATCH_DELAY = 1000; // Longer delays for massive downloads to avoid rate limits
    } else if (filesToDownload.length > 10000) {
      BATCH_DELAY = 750;
    }

    let successCount = 0;
    let errorCount = 0;
    const startTime = Date.now();

    console.log(
      `🚀 Starting bulk download of ${filesToDownload.length.toLocaleString()} files in batches of ${DOWNLOAD_BATCH_SIZE}`
    );

    for (let i = 0; i < filesToDownload.length; i += DOWNLOAD_BATCH_SIZE) {
      const batch = filesToDownload.slice(i, i + DOWNLOAD_BATCH_SIZE);
      const batchNumber = Math.floor(i / DOWNLOAD_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(
        filesToDownload.length / DOWNLOAD_BATCH_SIZE
      );

      console.log(
        `Processing batch ${batchNumber}/${totalBatches} (files ${
          i + 1
        }-${Math.min(i + DOWNLOAD_BATCH_SIZE, filesToDownload.length)})`
      );

      await Promise.all(
        batch.map(async (file) => {
          try {
            await downloadFile(file, false);
            successCount++;
          } catch (err) {
            errorCount++;
            console.error(
              `Failed to download ${file.Title || file.Name}:`,
              err
            );
          }
          setDownloadProgress((prev) => ({
            current: prev.current + 1,
            total: prev.total,
          }));
        })
      );

      // Progress reporting every 100 batches for large downloads
      if (batchNumber % 100 === 0 || batchNumber === totalBatches) {
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        const filesPerMinute = (successCount + errorCount) / elapsedMinutes;
        const estimatedRemainingMinutes =
          (filesToDownload.length - (successCount + errorCount)) /
          filesPerMinute;

        console.log(
          `📊 Progress: ${batchNumber}/${totalBatches} batches | ${successCount} success, ${errorCount} errors | ${filesPerMinute.toFixed(
            1
          )} files/min | ~${estimatedRemainingMinutes.toFixed(1)} min remaining`
        );
      }

      // Add delay between batches (except for the last batch)
      if (i + DOWNLOAD_BATCH_SIZE < filesToDownload.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    const totalTime = (Date.now() - startTime) / 60000;
    const finalMessage = `✅ Bulk download completed in ${totalTime.toFixed(
      1
    )} minutes!\n📊 Results: ${successCount.toLocaleString()} successful, ${errorCount.toLocaleString()} failed`;

    console.log(finalMessage);

    setTimeout(() => {
      setDownloadProgress({ current: 0, total: 0 });
      if (errorCount > 0) {
        setError(finalMessage);
      } else {
        setSoqlError(finalMessage);
      }
    }, 500);
  };

  const toggleFileSelection = (fileId) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllFiles = () => {
    if (selectedFiles.size === files.length && files.length > 0) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.Id)));
    }
  };

  const logout = () => {
    setConnectionStatus("disconnected");
    setAccessToken("");
    setInstanceUrl("");
    setUserInfo(null);
    setFiles([]);
    setSelectedFiles(new Set());
    setDownloadProgress({ current: 0, total: 0 });
    setError("");
    setSoqlQuery("");
    setSoqlError("");
    setSelectedFolder(null);
    setQueryValidation({ isValid: null, message: "" });
    setFileDownloadStatus(new Map());
  };

  const getFileIcon = (file) => {
    const extension = file.FileExtension || file.ContentType || file.Type || "";
    const lower = extension.toLowerCase();

    if (
      lower.includes("image") ||
      ["jpg", "jpeg", "png", "gif", "bmp"].includes(lower)
    ) {
      return (
        <Image style={{ width: "16px", height: "16px", color: "#3b82f6" }} />
      );
    } else if (lower.includes("pdf") || ["pdf"].includes(lower)) {
      return (
        <FileText style={{ width: "16px", height: "16px", color: "#ef4444" }} />
      );
    } else {
      return (
        <File style={{ width: "16px", height: "16px", color: "#6b7280" }} />
      );
    }
  };

  const getDownloadStatusIcon = (fileId) => {
    const status = fileDownloadStatus.get(fileId);

    switch (status) {
      case "downloading":
        return (
          <Loader
            style={{
              width: "16px",
              height: "16px",
              color: "#3b82f6",
              animation: "spin 1s linear infinite",
            }}
          />
        );
      case "success":
        return (
          <Check
            style={{
              width: "16px",
              height: "16px",
              color: "#10b981",
            }}
          />
        );
      case "error":
        return (
          <X
            style={{
              width: "16px",
              height: "16px",
              color: "#ef4444",
            }}
          />
        );
      default:
        return null;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <CheckCircle
            style={{ width: "20px", height: "20px", color: "#10b981" }}
          />
        );
      case "connecting":
        return (
          <Loader
            style={{
              width: "20px",
              height: "20px",
              color: "#3b82f6",
              animation: "spin 1s linear infinite",
            }}
          />
        );
      case "error":
        return (
          <AlertCircle
            style={{ width: "20px", height: "20px", color: "#ef4444" }}
          />
        );
      default:
        return (
          <Database
            style={{ width: "20px", height: "20px", color: "#9ca3af" }}
          />
        );
    }
  };

  // Inline styles
  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)",
      padding: "24px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    mainCard: {
      backgroundColor: "white",
      borderRadius: "12px",
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
      overflow: "hidden",
      maxWidth: "1200px",
      margin: "0 auto",
    },
    header: {
      background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
      padding: "16px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerContent: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    headerTitle: {
      fontSize: "24px",
      fontWeight: "bold",
      color: "white",
      margin: "0",
    },
    headerSubtitle: {
      color: "#dbeafe",
      fontSize: "14px",
    },
    logoutButton: {
      backgroundColor: "#ef4444",
      color: "white",
      padding: "8px 16px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    content: {
      padding: "24px",
    },
    textarea: {
      width: "100%",
      padding: "12px 16px",
      border: "1px solid #d1d5db",
      borderRadius: "8px",
      fontSize: "14px",
      fontFamily: "Monaco, 'Cascadia Code', 'Roboto Mono', monospace",
      outline: "none",
      boxSizing: "border-box",
      resize: "vertical",
      minHeight: "150px",
    },
    buttonLarge: {
      width: "100%",
      backgroundColor: "#2563eb",
      color: "white",
      padding: "12px",
      borderRadius: "8px",
      border: "none",
      fontSize: "16px",
      fontWeight: "500",
      cursor: "pointer",
    },
    buttonGreen: {
      backgroundColor: "#10b981",
      color: "white",
      padding: "8px 16px",
      borderRadius: "6px",
      border: "none",
      fontSize: "14px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    buttonPurple: {
      backgroundColor: "#7c3aed",
      color: "white",
      padding: "12px 24px",
      borderRadius: "8px",
      border: "none",
      fontSize: "16px",
      fontWeight: "500",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
    section: {
      backgroundColor: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      padding: "24px",
      marginBottom: "24px",
    },
    sectionBlue: {
      backgroundColor: "#eff6ff",
      border: "1px solid #bfdbfe",
      borderRadius: "8px",
      padding: "24px",
      marginBottom: "24px",
    },
    sectionGreen: {
      backgroundColor: "#f0fdf4",
      border: "1px solid #bbf7d0",
      borderRadius: "8px",
      padding: "16px",
      marginBottom: "24px",
    },
    sectionPurple: {
      backgroundColor: "#faf5ff",
      border: "1px solid #d8b4fe",
      borderRadius: "8px",
      padding: "24px",
      marginBottom: "24px",
    },
    errorBox: {
      backgroundColor: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: "8px",
      padding: "16px",
      marginBottom: "16px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    successBox: {
      backgroundColor: "#f0fdf4",
      border: "1px solid #bbf7d0",
      borderRadius: "8px",
      padding: "16px",
      marginBottom: "16px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    warningBox: {
      backgroundColor: "#fffbeb",
      border: "1px solid #fed7aa",
      borderRadius: "8px",
      padding: "16px",
      marginBottom: "16px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    progressBar: {
      width: "100%",
      backgroundColor: "#e5e7eb",
      borderRadius: "4px",
      height: "8px",
    },
    progressFill: {
      height: "100%",
      borderRadius: "4px",
      transition: "width 0.3s ease",
    },
    fileList: {
      maxHeight: "400px",
      overflowY: "auto",
      border: "1px solid #e5e7eb",
    },
    fileItem: {
      padding: "12px 24px",
      borderBottom: "1px solid #f3f4f6",
      display: "flex",
      alignItems: "center",
      gap: "16px",
    },
    flexBetween: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    },
    codeBlock: {
      backgroundColor: "#f3f4f6",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      padding: "12px",
      fontFamily: "Monaco, 'Cascadia Code', 'Roboto Mono', monospace",
      fontSize: "14px",
      marginTop: "12px",
      overflow: "auto",
    },
  };

  // Main application - direct launch without authentication screen
  return (
    <div style={styles.container}>
      <div style={styles.mainCard}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <Settings
              style={{ width: "32px", height: "32px", color: "white" }}
            />
            <div>
              <h1 style={styles.headerTitle}>Salesforce File Extractor</h1>
              <p style={styles.headerSubtitle}>
                Execute custom SOQL queries to find and download files
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {userInfo && (
              <div style={{ textAlign: "right", color: "white" }}>
                <div style={{ fontWeight: "500" }}>{userInfo.name}</div>
                <div style={{ fontSize: "12px", color: "#dbeafe" }}>
                  {userInfo.email}
                </div>
              </div>
            )}
            {connectionStatus === "connected" && (
              <button onClick={handleMainLogout} style={styles.logoutButton}>
                <LogOut style={{ width: "16px", height: "16px" }} />
              </button>
            )}
          </div>
        </div>

        <div style={styles.content}>
          {/* Connection Status */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              {getStatusIcon()}
              <span style={{ fontWeight: "500" }}>
                Connection Status:
                <span
                  style={{
                    marginLeft: "8px",
                    textTransform: "capitalize",
                    color:
                      connectionStatus === "connected"
                        ? "#059669"
                        : connectionStatus === "error"
                        ? "#dc2626"
                        : connectionStatus === "connecting"
                        ? "#2563eb"
                        : "#6b7280",
                  }}
                >
                  {connectionStatus}
                </span>
              </span>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <AlertCircle
                  style={{ width: "20px", height: "20px", color: "#ef4444" }}
                />
                <span style={{ color: "#dc2626" }}>{error}</span>
              </div>
            )}
          </div>

          {connectionStatus !== "connected" && (
            <div style={styles.section}>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  marginBottom: "16px",
                }}
              >
                🚀 Connect to Salesforce
              </h3>

              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Salesforce Environment
                </label>
                <div
                  style={{ display: "flex", gap: "16px", marginBottom: "16px" }}
                >
                  <label style={{ display: "flex", alignItems: "center" }}>
                    <input
                      type="radio"
                      name="instanceType"
                      value="production"
                      checked={instanceType === "production"}
                      onChange={(e) => setInstanceType(e.target.value)}
                      style={{ marginRight: "8px" }}
                    />
                    Production
                  </label>
                  <label style={{ display: "flex", alignItems: "center" }}>
                    <input
                      type="radio"
                      name="instanceType"
                      value="sandbox"
                      checked={instanceType === "sandbox"}
                      onChange={(e) => setInstanceType(e.target.value)}
                      style={{ marginRight: "8px" }}
                    />
                    Sandbox
                  </label>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={usePopup}
                    onChange={(e) => setUsePopup(e.target.checked)}
                    style={{ marginRight: "8px" }}
                  />
                  <span style={{ fontSize: "14px", color: "#374151" }}>
                    Use popup window (for restrictive environments)
                  </span>
                </label>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={styles.sectionBlue}>
                  <h4
                    style={{
                      fontWeight: "600",
                      color: "#1e40af",
                      marginBottom: "12px",
                      fontSize: "18px",
                    }}
                  >
                    🔒 Secure OAuth2 Authentication
                  </h4>
                  <p style={{ color: "#6b7280", marginBottom: "24px" }}>
                    Connect securely to execute SOQL queries and download files
                  </p>

                  <button
                    onClick={connectToSalesforce}
                    disabled={loading}
                    style={{
                      ...styles.buttonLarge,
                      fontSize: "18px",
                      padding: "12px 32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      margin: "0 auto",
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <ExternalLink style={{ width: "20px", height: "20px" }} />
                    {usePopup ? "Login with Popup" : "Login with Salesforce"}
                  </button>

                  <div
                    style={{
                      marginTop: "16px",
                      fontSize: "12px",
                      color: "#6b7280",
                      lineHeight: "1.5",
                    }}
                  >
                    <p>
                      <strong>✅ Universal Compatibility:</strong>
                    </p>
                    <p>
                      • Works with localhost, GitHub Pages, and custom domains
                    </p>
                    <p>• Smart redirect URI detection</p>
                    <p>• Popup fallback for restrictive environments</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {connectionStatus === "connecting" && (
            <div style={styles.sectionBlue}>
              <div style={{ textAlign: "center" }}>
                <Loader
                  style={{
                    width: "32px",
                    height: "32px",
                    margin: "0 auto 16px auto",
                    color: "#2563eb",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1e40af",
                    marginBottom: "8px",
                  }}
                >
                  Connecting to Salesforce...
                </h3>
                <p style={{ color: "#2563eb" }}>
                  Authenticating and preparing SOQL query interface...
                </p>
              </div>
            </div>
          )}

          {connectionStatus === "connected" && (
            <div>
              {/* User Info */}
              {userInfo && (
                <div style={styles.sectionGreen}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <CheckCircle
                        style={{
                          width: "24px",
                          height: "24px",
                          color: "#10b981",
                        }}
                      />
                      <div>
                        <h3 style={{ fontWeight: "600", color: "#059669" }}>
                          🎉 Successfully Connected!
                        </h3>
                        <p style={{ fontSize: "14px", color: "#047857" }}>
                          Logged in as {userInfo.name} ({userInfo.email})
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const response = await fetch(
                            `${instanceUrl}/services/data/v58.0/sobjects/`,
                            {
                              headers: {
                                Authorization: `Bearer ${accessToken}`,
                                "Content-Type": "application/json",
                              },
                            }
                          );
                          if (response.ok) {
                            setError("");
                            alert("✅ Connection test successful!");
                          } else {
                            throw new Error(
                              `Connection test failed: ${response.status}`
                            );
                          }
                        } catch (err) {
                          setError(`Connection test failed: ${err.message}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      style={{
                        backgroundColor: "#6b7280",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      disabled={loading}
                    >
                      <Activity style={{ width: "14px", height: "14px" }} />
                      Test Connection
                    </button>
                  </div>
                </div>
              )}

              {/* Folder Selection */}
              {folderSupported && (
                <div style={styles.sectionGreen}>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      marginBottom: "16px",
                      color: "#059669",
                    }}
                  >
                    📁 Smart Folder Organization
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {selectedFolder ? (
                        <div style={styles.successBox}>
                          <FolderOpen
                            style={{
                              width: "16px",
                              height: "16px",
                              color: "#10b981",
                            }}
                          />
                          <span style={{ color: "#059669", fontSize: "14px" }}>
                            Selected folder: {selectedFolder.name}
                          </span>
                        </div>
                      ) : (
                        <p
                          style={{
                            color: "#047857",
                            fontSize: "14px",
                            margin: 0,
                          }}
                        >
                          Choose a folder to organize your downloads (optional)
                        </p>
                      )}
                    </div>
                    <button
                      onClick={selectDownloadFolder}
                      style={styles.buttonGreen}
                    >
                      <Folder style={{ width: "16px", height: "16px" }} />
                      {selectedFolder ? "Change Folder" : "Select Folder"}
                    </button>
                  </div>
                </div>
              )}

              {/* SOQL Query Builder */}
              <div style={styles.sectionPurple}>
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: "600",
                    marginBottom: "16px",
                    color: "#6b21a8",
                  }}
                >
                  ⚡ SOQL Query Builder
                </h3>

                {/* CORS Proxy Toggle */}
                <div
                  style={{
                    backgroundColor: "#fef3c7",
                    border: "1px solid #f59e0b",
                    borderRadius: "8px",
                    padding: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <AlertCircle
                      style={{
                        width: "20px",
                        height: "20px",
                        color: "#d97706",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: "#92400e" }}>
                        CORS Configuration
                      </strong>
                      <p
                        style={{
                          color: "#92400e",
                          fontSize: "14px",
                          margin: "4px 0 0 0",
                        }}
                      >
                        Enable CORS proxy if you encounter "Failed to fetch" or
                        CORS errors.
                      </p>
                    </div>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={useProxy}
                        onChange={(e) => setUseProxy(e.target.checked)}
                        style={{ marginRight: "8px" }}
                      />
                      <span style={{ color: "#92400e", fontWeight: "500" }}>
                        Enable CORS Proxy (cors-anywhere.herokuapp.com)
                      </span>
                    </label>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#92400e",
                        marginTop: "4px",
                      }}
                    >
                      ⚠️ You may need to visit{" "}
                      <a
                        href="https://cors-anywhere.herokuapp.com/corsdemo"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#d97706" }}
                      >
                        cors-anywhere.herokuapp.com/corsdemo
                      </a>{" "}
                      first to enable access.
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "8px",
                    }}
                  >
                    SOQL Query
                  </label>
                  <textarea
                    value={soqlQuery}
                    onChange={(e) => setSoqlQuery(e.target.value)}
                    placeholder="Enter your SOQL query here..."
                    style={styles.textarea}
                  />

                  {queryValidation.isValid !== null && (
                    <div
                      style={
                        queryValidation.isValid
                          ? styles.successBox
                          : styles.errorBox
                      }
                    >
                      {queryValidation.isValid ? (
                        <CheckCircle
                          style={{
                            width: "16px",
                            height: "16px",
                            color: "#10b981",
                          }}
                        />
                      ) : (
                        <AlertCircle
                          style={{
                            width: "16px",
                            height: "16px",
                            color: "#ef4444",
                          }}
                        />
                      )}
                      <span
                        style={{
                          color: queryValidation.isValid
                            ? "#059669"
                            : "#dc2626",
                          fontSize: "14px",
                        }}
                      >
                        {queryValidation.message}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                      marginTop: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Code style={{ width: "12px", height: "12px" }} />
                    <span>
                      Write your SOQL query to find files in Salesforce
                    </span>
                  </div>
                </div>

                {soqlError && (
                  <div style={styles.errorBox}>
                    <AlertCircle
                      style={{
                        width: "20px",
                        height: "20px",
                        color: "#ef4444",
                      }}
                    />
                    <div
                      style={{
                        color: "#dc2626",
                        fontSize: "14px",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {soqlError}
                    </div>
                  </div>
                )}

                <button
                  onClick={executeCustomQuery}
                  disabled={
                    !soqlQuery.trim() ||
                    loading ||
                    queryValidation.isValid === false
                  }
                  style={{
                    ...styles.buttonPurple,
                    opacity:
                      !soqlQuery.trim() ||
                      loading ||
                      queryValidation.isValid === false
                        ? 0.5
                        : 1,
                    cursor:
                      !soqlQuery.trim() ||
                      loading ||
                      queryValidation.isValid === false
                        ? "not-allowed"
                        : "pointer",
                    width: "100%",
                  }}
                >
                  {loading ? (
                    <Loader
                      style={{
                        width: "20px",
                        height: "20px",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  ) : (
                    <Play style={{ width: "20px", height: "20px" }} />
                  )}
                  Execute SOQL Query {useProxy && "(via Proxy)"}
                </button>

                <div style={styles.codeBlock}>
                  <strong>💡 Example SOQL Queries:</strong>
                  <br />
                  <code>
                    SELECT Id, Title, FileExtension, ContentSize FROM
                    ContentDocument WHERE CreatedDate = LAST_N_DAYS:7 LIMIT 50
                  </code>
                  <br />
                  <code>
                    SELECT Id, Name, ContentType, BodyLength FROM Attachment
                    WHERE Parent.Type = 'Account' LIMIT 100
                  </code>
                  <br />
                  <code>
                    SELECT Id, Name, Type FROM Document WHERE Type = 'pdf' ORDER
                    BY CreatedDate DESC LIMIT 25
                  </code>
                  <br />
                  <code>
                    SELECT Id, Title FROM ContentDocument WHERE ContentSize &gt;
                    1000000 ORDER BY ContentSize DESC
                  </code>
                </div>
              </div>

              {/* Download Progress */}
              {downloadProgress.total > 0 && (
                <div style={styles.sectionGreen}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <Download
                      style={{
                        width: "20px",
                        height: "20px",
                        color: "#10b981",
                      }}
                    />
                    <span style={{ fontWeight: "500", color: "#059669" }}>
                      📥 Downloading files... {downloadProgress.current} of{" "}
                      {downloadProgress.total}
                      {selectedFolder && " to selected folder"}
                    </span>
                  </div>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        backgroundColor: "#10b981",
                        width: `${
                          (downloadProgress.current / downloadProgress.total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Files List */}
              {files.length > 0 && (
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      padding: "16px 24px",
                      borderBottom: "1px solid #f3f4f6",
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    <div style={styles.flexBetween}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={
                              files.length > 0 &&
                              selectedFiles.size === files.length
                            }
                            onChange={selectAllFiles}
                            style={{
                              cursor: "pointer",
                              transform: "scale(1.2)",
                            }}
                            disabled={files.length === 0}
                          />
                          <h3
                            style={{
                              fontSize: "18px",
                              fontWeight: "600",
                              margin: 0,
                            }}
                          >
                            📁 Files ({files.length.toLocaleString()})
                          </h3>
                        </div>
                        <button
                          onClick={selectAllFiles}
                          style={{
                            fontSize: "14px",
                            color: "#2563eb",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                          disabled={files.length === 0}
                        >
                          {selectedFiles.size === files.length &&
                          files.length > 0
                            ? "Deselect All"
                            : "Select All"}
                        </button>
                        {selectedFiles.size > 0 && (
                          <span
                            style={{
                              backgroundColor: "#fef3c7",
                              color: "#92400e",
                              padding: "4px 8px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: "500",
                            }}
                          >
                            {selectedFiles.size} selected
                          </span>
                        )}
                      </div>
                      {/* Enhanced Download Selected button with file count and warnings */}
                      {selectedFiles.size > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          {selectedFiles.size > 10000 && (
                            <span
                              style={{
                                backgroundColor: "#fef2f2",
                                color: "#dc2626",
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: "500",
                                border: "1px solid #fecaca",
                              }}
                            >
                              ⚠️ Large Download (
                              {selectedFiles.size.toLocaleString()} files)
                            </span>
                          )}
                          <button
                            onClick={downloadSelectedFiles}
                            disabled={downloadProgress.total > 0}
                            style={{
                              ...styles.buttonGreen,
                              opacity: downloadProgress.total > 0 ? 0.5 : 1,
                              cursor:
                                downloadProgress.total > 0
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            <Download
                              style={{ width: "16px", height: "16px" }}
                            />
                            Download Selected (
                            {selectedFiles.size.toLocaleString()})
                            {selectedFolder && " 📁"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={styles.fileList}>
                    {files.map((file) => (
                      <div key={file.Id} style={styles.fileItem}>
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.Id)}
                          onChange={() => toggleFileSelection(file.Id)}
                          style={{ cursor: "pointer" }}
                        />

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {getFileIcon(file)}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: "500",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {file.Title || file.Name}
                            </div>
                            <div
                              style={{
                                fontSize: "14px",
                                color: "#6b7280",
                                display: "flex",
                                gap: "16px",
                                flexWrap: "wrap",
                              }}
                            >
                              <span>
                                {formatFileSize(
                                  file.ContentSize || file.BodyLength
                                )}
                              </span>
                              {file.LastModifiedDate && (
                                <span>
                                  {new Date(
                                    file.LastModifiedDate
                                  ).toLocaleDateString()}
                                </span>
                              )}
                              {file.CreatedBy?.Name && (
                                <span>by {file.CreatedBy.Name}</span>
                              )}
                              {file.Parent?.Name && (
                                <span>📎 {file.Parent.Name}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Download Status Icon */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            minWidth: "24px",
                          }}
                        >
                          {getDownloadStatusIcon(file.Id)}
                        </div>

                        <button
                          onClick={() => {
                            downloadFile(file).catch((err) => {
                              console.error("Individual download failed:", err);
                            });
                          }}
                          disabled={
                            downloadingFiles.has(file.Id) ||
                            downloadProgress.total > 0
                          }
                          style={{
                            backgroundColor: "#2563eb",
                            color: "white",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "none",
                            cursor:
                              downloadingFiles.has(file.Id) ||
                              downloadProgress.total > 0
                                ? "not-allowed"
                                : "pointer",
                            opacity:
                              downloadingFiles.has(file.Id) ||
                              downloadProgress.total > 0
                                ? 0.5
                                : 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                          }}
                          title={`Download ${file.Title || file.Name}`}
                        >
                          {downloadingFiles.has(file.Id) ? (
                            <Loader
                              style={{
                                width: "16px",
                                height: "16px",
                                animation: "spin 1s linear infinite",
                              }}
                            />
                          ) : (
                            <Download
                              style={{ width: "16px", height: "16px" }}
                            />
                          )}
                          {downloadingFiles.has(file.Id) ? "..." : "Download"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Simple Info Section */}
      <div style={{ ...styles.mainCard, marginTop: "24px" }}>
        <div style={styles.content}>
          <h3
            style={{
              fontSize: "20px",
              fontWeight: "600",
              marginBottom: "16px",
              color: "#1f2937",
            }}
          >
            🚀 Simple & Powerful File Extraction
          </h3>

          <div style={{ display: "grid", gap: "16px" }}>
            <div style={styles.sectionPurple}>
              <h4
                style={{
                  fontWeight: "600",
                  color: "#6b21a8",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Code style={{ width: "18px", height: "18px" }} />✅ Custom SOQL
                Queries
              </h4>
              <ul
                style={{
                  marginLeft: "16px",
                  color: "#7c2d92",
                  lineHeight: "1.6",
                }}
              >
                <li>
                  Execute any SOQL query to find exactly the files you need
                </li>
                <li>Real-time query validation and syntax checking</li>
                <li>
                  Automatic pagination to retrieve ALL records (no 2000 limit)
                </li>
                <li>
                  Filter by date, size, creator, parent object, file type, etc.
                </li>
                <li>
                  Works with ContentDocument, Attachment, Document, and custom
                  objects
                </li>
              </ul>
            </div>

            <div style={styles.sectionGreen}>
              <h4
                style={{
                  fontWeight: "600",
                  color: "#059669",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FolderOpen style={{ width: "18px", height: "18px" }} />✅ Smart
                Folder Organization
              </h4>
              <ul
                style={{
                  marginLeft: "16px",
                  color: "#047857",
                  lineHeight: "1.6",
                }}
              >
                <li>Choose custom download folders in modern browsers</li>
                <li>
                  Direct file writing to selected folders for organization
                </li>
                <li>Automatic fallback to browser downloads folder</li>
                <li>Perfect for organizing large file exports</li>
              </ul>
            </div>

            <div style={styles.sectionBlue}>
              <h4
                style={{
                  fontWeight: "600",
                  color: "#1e40af",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Download style={{ width: "18px", height: "18px" }} />✅
                Flexible Downloads
              </h4>
              <ul
                style={{
                  marginLeft: "16px",
                  color: "#1e3a8a",
                  lineHeight: "1.6",
                }}
              >
                <li>Individual file downloads with one click</li>
                <li>Massive bulk download support for 500k+ files</li>
                <li>Adaptive batch processing with smart rate limiting</li>
                <li>Large download warnings and confirmation dialogs</li>
                <li>
                  Original file format preservation (PDF, DOCX, images, etc.)
                </li>
                <li>Visual download status indicators for each file</li>
                <li>Detailed progress reporting and time estimates</li>
              </ul>
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h4
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1f2937",
                marginBottom: "12px",
                textAlign: "center",
              }}
            >
              🎯 How to Use This Tool
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "12px",
                fontSize: "14px",
                color: "#374151",
              }}
            >
              <div>
                <strong>1. Connect:</strong> Login to your Salesforce org using
                OAuth2
              </div>
              <div>
                <strong>2. Query:</strong> Write SOQL to find the files you want
              </div>
              <div>
                <strong>3. Select:</strong> Choose files individually or select
                all
              </div>
              <div>
                <strong>4. Download:</strong> Individual downloads or bulk
                selected files with status tracking
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
