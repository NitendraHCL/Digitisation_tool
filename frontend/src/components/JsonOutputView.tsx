import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  useTheme,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Refresh as RepeatIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface JsonOutputViewProps {
  jsonData: any;
  orderId: string;
  onRepeatReview: () => void;
  onBack: () => void;
}

const JsonOutputView: React.FC<JsonOutputViewProps> = ({
  jsonData,
  orderId,
  onRepeatReview,
  onBack,
}) => {
  const theme = useTheme();
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyToClipboard = () => {
    const jsonString = JSON.stringify(jsonData, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopySuccess(true);
  };

  const handleDownload = () => {
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${orderId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const jsonString = JSON.stringify(jsonData, null, 2);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Generated JSON Output
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Final structured data for Order ID: {orderId}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* JSON Display */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            JSON Data
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Copy to Clipboard">
              <IconButton onClick={handleCopyToClipboard} color="primary">
                <CopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download JSON">
              <IconButton onClick={handleDownload} color="primary">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box
          sx={{
            maxHeight: '60vh',
            overflow: 'auto',
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: theme.shape.borderRadius,
              fontSize: '14px',
            }}
            showLineNumbers
          >
            {jsonString}
          </SyntaxHighlighter>
        </Box>
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={onBack}
        >
          Back to Reports
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
          >
            Download JSON
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RepeatIcon />}
            onClick={onRepeatReview}
          >
            Repeat Review
          </Button>
        </Box>
      </Box>

      {/* Copy Success Snackbar */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopySuccess(false)} severity="success" sx={{ width: '100%' }}>
          JSON copied to clipboard!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default JsonOutputView;
