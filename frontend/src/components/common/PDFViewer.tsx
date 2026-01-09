import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  OpenInNew as OpenInNewIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
} from '@mui/icons-material';

interface PDFViewerProps {
  pdfUrl: string;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, currentPage = 1, totalPages, onPageChange }) => {
  const [zoom, setZoom] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  console.log('[PDF VIEWER] ========== IFRAME PDF VIEWER ==========');
  console.log('[PDF VIEWER] Received pdfUrl:', pdfUrl);
  console.log('[PDF VIEWER] Current Page:', currentPage);
  console.log('[PDF VIEWER] Total Pages:', totalPages);
  console.log('[PDF VIEWER] URL type:', typeof pdfUrl);
  console.log('[PDF VIEWER] Loading state:', loading);
  console.log('[PDF VIEWER] Error state:', error);
  console.log('[PDF VIEWER] Zoom:', zoom);

  // Track loading state changes
  React.useEffect(() => {
    console.log('[PDF VIEWER] Loading state changed to:', loading);
    console.log('[PDF VIEWER] Iframe display style will be:', loading ? 'none' : 'block');
  }, [loading]);

  const handleLoad = () => {
    console.log('[PDF VIEWER] ✓ PDF loaded successfully in iframe');
    console.log('[PDF VIEWER] Setting loading to false, iframe should now be visible');

    // Try to detect if iframe actually loaded content or error page
    try {
      if (iframeRef.current) {
        console.log('[PDF VIEWER] Iframe current src:', iframeRef.current.src);
        console.log('[PDF VIEWER] Iframe contentWindow exists:', !!iframeRef.current.contentWindow);

        // Try to access iframe document (will fail if COEP/CORP blocks it)
        try {
          const iframeDoc = iframeRef.current.contentWindow?.document;
          if (iframeDoc) {
            console.log('[PDF VIEWER] Iframe document accessible:', true);
            console.log('[PDF VIEWER] Iframe document title:', iframeDoc.title);
            console.log('[PDF VIEWER] Iframe document body exists:', !!iframeDoc.body);
          }
        } catch (securityError) {
          console.warn('[PDF VIEWER] ⚠️  Cannot access iframe content (CORS/Security):', securityError instanceof Error ? securityError.message : String(securityError));
          console.warn('[PDF VIEWER] This is expected for cross-origin PDFs');
        }
      }
    } catch (err) {
      console.error('[PDF VIEWER] Error checking iframe:', err);
    }

    setLoading(false);
    setError(null);
  };

  const handleError = (e: any) => {
    console.error('[PDF VIEWER] ✗ Error loading PDF in iframe');
    console.error('[PDF VIEWER] Error event:', e);
    console.error('[PDF VIEWER] Error type:', e?.type);
    console.error('[PDF VIEWER] Error target:', e?.target);
    setError('Failed to load PDF. Please try opening it in a new tab.');
    setLoading(false);
  };

  const zoomIn = () => {
    setZoom((prev) => Math.min(200, prev + 10));
  };

  const zoomOut = () => {
    setZoom((prev) => Math.max(50, prev - 10));
  };

  const openInNewTab = () => {
    window.open(pdfUrl, '_blank');
  };

  const handlePrevPage = () => {
    if (onPageChange && currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (onPageChange && totalPages && currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* PDF Controls */}
      <Box
        sx={{
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'grey.100',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            PDF Document
          </Typography>
          {totalPages && totalPages > 1 && (
            <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
              • Page {currentPage} of {totalPages}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={zoomOut} disabled={zoom <= 50} size="small" title="Zoom Out">
            <ZoomOutIcon />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: '45px', textAlign: 'center' }}>
            {zoom}%
          </Typography>
          <IconButton onClick={zoomIn} disabled={zoom >= 200} size="small" title="Zoom In">
            <ZoomInIcon />
          </IconButton>
          <IconButton onClick={openInNewTab} size="small" title="Open in New Tab">
            <OpenInNewIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Page Navigation (if page-wise viewing is enabled) */}
      {totalPages && totalPages > 1 && onPageChange && (
        <Box
          sx={{
            p: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            startIcon={<PrevIcon />}
          >
            Previous
          </Button>
          <Typography variant="body2" sx={{ minWidth: '80px', textAlign: 'center', fontWeight: 600 }}>
            {currentPage} / {totalPages}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            endIcon={<NextIcon />}
          >
            Next
          </Button>
        </Box>
      )}

      {/* PDF Document */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'grey.100',
          position: 'relative',
        }}
      >
        {loading && !error && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              zIndex: 1,
            }}
          >
            <CircularProgress size={24} />
            <Typography variant="body2">Loading PDF...</Typography>
          </Box>
        )}

        {error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
            <Box sx={{ mt: 1 }}>
              <IconButton onClick={openInNewTab} size="small" color="primary">
                <OpenInNewIcon sx={{ mr: 0.5 }} />
                <Typography variant="caption">Open in New Tab</Typography>
              </IconButton>
            </Box>
          </Alert>
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              overflow: 'auto',
              display: loading ? 'none' : 'block',
            }}
          >
            <iframe
              key={`pdf-page-${currentPage}`}
              ref={iframeRef}
              src={`${pdfUrl}#page=${currentPage}&view=FitH&pagemode=none&toolbar=0&navpanes=0&scrollbar=1`}
              title="PDF Viewer"
              onLoad={handleLoad}
              onError={handleError}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
              }}
            />
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default PDFViewer;
