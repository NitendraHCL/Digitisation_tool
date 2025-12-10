import React, { useState, useEffect, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Paper,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { debounce } from 'lodash';
import api from '../../services/api';

interface Parameter {
  _id: string;
  parameterId: string;
  parameterName: string;
  aliases: string[];
  possibleUnits: string[];
  valueType: string;
  description?: string;
}

interface ParameterSearchFieldProps {
  value: Parameter | null;
  onChange: (parameter: Parameter | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
}

const ParameterSearchField: React.FC<ParameterSearchFieldProps> = ({
  value,
  onChange,
  label = 'Search Parameter',
  placeholder = 'Type to search parameters...',
  disabled = false,
  required = false,
  error = false,
  helperText,
  fullWidth = true,
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Parameter[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Debounced search function
  const searchParameters = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 2) {
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get('/parameter-suggestions/search-parameters', {
          params: { q: query }
        });

        if (response.data.success) {
          setOptions(response.data.data || []);
        }
      } catch (error) {
        console.error('Failed to search parameters:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (inputValue) {
      searchParameters(inputValue);
    } else {
      setOptions([]);
    }
  }, [inputValue, searchParameters]);

  const getOptionLabel = (option: Parameter) => {
    return `${option.parameterName} (${option.parameterId})`;
  };

  const renderOption = (props: any, option: Parameter) => (
    <Box component="li" {...props} sx={{ py: 1.5, px: 2 }}>
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {option.parameterName}
          </Typography>
          <Chip
            label={option.parameterId}
            size="small"
            sx={{ ml: 1, fontSize: '11px', height: 20 }}
          />
        </Box>

        {option.aliases.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Aliases: {option.aliases.join(', ')}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Chip
            label={option.valueType}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: '10px', height: 18 }}
          />
          {option.possibleUnits.length > 0 && (
            <Chip
              label={`Units: ${option.possibleUnits.join(', ')}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '10px', height: 18 }}
            />
          )}
        </Box>

        {option.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {option.description}
          </Typography>
        )}
      </Box>
    </Box>
  );

  const renderSelectedValue = (option: Parameter | null) => {
    if (!option) return '';

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">
          {option.parameterName}
        </Typography>
        <Chip
          label={option.parameterId}
          size="small"
          sx={{ fontSize: '11px', height: 20 }}
        />
      </Box>
    );
  };

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      value={value}
      onChange={(event, newValue) => {
        onChange(newValue);
      }}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      options={options}
      loading={loading}
      disabled={disabled}
      fullWidth={fullWidth}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(option, value) => option._id === value._id}
      renderOption={renderOption}
      noOptionsText={
        inputValue.length < 2
          ? 'Type at least 2 characters to search'
          : 'No parameters found'
      }
      PaperComponent={({ children, ...props }) => (
        <Paper {...props} sx={{ maxHeight: 400, overflow: 'auto' }}>
          {children}
        </Paper>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'action.active' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <React.Fragment>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </React.Fragment>
            ),
          }}
        />
      )}
    />
  );
};

export default ParameterSearchField;