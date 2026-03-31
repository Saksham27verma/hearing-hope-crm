'use client';

import { CRM_MODULE_ACCESS_OPTIONS } from '@/components/Layout/crm-nav-config';
import type { UserProfile } from '@/context/AuthContext';
import { isSuperAdminViewer } from '@/lib/tenant/centerScope';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type Role = 'admin' | 'staff' | 'audiologist';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centers: Array<{ id: string; name: string }>;
  lockedCenterId: string | null;
  userProfile: UserProfile | null;
  createUserEmail: string;
  setCreateUserEmail: (v: string) => void;
  createUserName: string;
  setCreateUserName: (v: string) => void;
  createUserRole: Role;
  setCreateUserRole: (v: Role) => void;
  createUserModules: string[];
  setCreateUserModules: React.Dispatch<React.SetStateAction<string[]>>;
  createUserCenterIds: string[];
  setCreateUserCenterIds: React.Dispatch<React.SetStateAction<string[]>>;
  createUserSuperAdmin: boolean;
  setCreateUserSuperAdmin: (v: boolean) => void;
  actionLoading: boolean;
  onSubmit: () => void;
};

const BRAND = '#0d9488';
const BRAND_HOVER = '#0f766e';

const FIELD = {
  '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
};

export default function CreateUserDialog({
  open,
  onOpenChange,
  centers,
  lockedCenterId,
  userProfile,
  createUserEmail,
  setCreateUserEmail,
  createUserName,
  setCreateUserName,
  createUserRole,
  setCreateUserRole,
  createUserModules,
  setCreateUserModules,
  createUserCenterIds,
  setCreateUserCenterIds,
  createUserSuperAdmin,
  setCreateUserSuperAdmin,
  actionLoading,
  onSubmit,
}: Props) {
  const toggleModule = (key: string) => {
    setCreateUserModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const showSuperAdmin =
    createUserRole === 'admin' && userProfile && isSuperAdminViewer(userProfile);

  const centerOptions = centers.map((c) => ({ id: c.id, label: c.name }));
  const selectedCenters = centerOptions.filter((o) => createUserCenterIds.includes(o.id));

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            border: '1px solid #e0e2e6',
            boxShadow: '0px 8px 32px rgba(0,0,0,0.08)',
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, letterSpacing: '-0.02em', pb: 0 }}>Invite teammate</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create an account and send a password setup email. Center assignment follows your data scope rules.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
              Work email
            </Typography>
            <TextField
              fullWidth
              type="email"
              value={createUserEmail}
              onChange={(e) => setCreateUserEmail(e.target.value)}
              placeholder="name@company.com"
              variant="outlined"
              size="small"
              autoComplete="off"
              sx={FIELD}
            />
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
              Display name (optional)
            </Typography>
            <TextField
              fullWidth
              value={createUserName}
              onChange={(e) => setCreateUserName(e.target.value)}
              placeholder="Full name"
              variant="outlined"
              size="small"
              sx={FIELD}
            />
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel id="invite-role-label">Role</InputLabel>
            <Select
              labelId="invite-role-label"
              label="Role"
              value={createUserRole}
              onChange={(e) => setCreateUserRole(e.target.value as Role)}
              sx={{ borderRadius: 1.5 }}
            >
              <MenuItem value="staff">Staff</MenuItem>
              <MenuItem value="audiologist">Audiologist</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>

          {!lockedCenterId ? (
            <Autocomplete
              multiple
              options={centerOptions}
              value={selectedCenters}
              onChange={(_, v) => setCreateUserCenterIds(v.map((x) => x.id))}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Centers (data scope)"
                  placeholder="Select one or more centers…"
                  size="small"
                  sx={FIELD}
                />
              )}
              filterOptions={(opts, state) => {
                const q = state.inputValue.trim().toLowerCase();
                if (!q) return opts;
                return opts.filter(
                  (o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
                );
              }}
            />
          ) : (
            <Box
              sx={{
                borderRadius: 1.5,
                border: '1px solid #b2dfdb',
                bgcolor: '#e0f2f1',
                px: 2,
                py: 1.5,
              }}
            >
              <Typography variant="body2" sx={{ color: '#004d40', fontWeight: 500 }}>
                New users are assigned to your locked center automatically.
              </Typography>
            </Box>
          )}

          {showSuperAdmin ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={createUserSuperAdmin}
                  onChange={(e) => setCreateUserSuperAdmin(e.target.checked)}
                  sx={{ color: BRAND, '&.Mui-checked': { color: BRAND } }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Super admin
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Global data scope and all centers.
                  </Typography>
                </Box>
              }
            />
          ) : null}

          {(createUserRole === 'staff' || createUserRole === 'audiologist') && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                Module access
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Optional — defaults apply if none selected.
              </Typography>
              <Box
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  border: '1px solid #e0e2e6',
                  borderRadius: 1.5,
                  p: 1,
                  bgcolor: '#fafbfc',
                }}
              >
                {CRM_MODULE_ACCESS_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.key}
                    control={
                      <Checkbox
                        size="small"
                        checked={createUserModules.includes(opt.key)}
                        onChange={() => toggleModule(opt.key)}
                        sx={{ color: BRAND, '&.Mui-checked': { color: BRAND } }}
                      />
                    }
                    label={<Typography variant="body2">{opt.label}</Typography>}
                    sx={{ display: 'flex', ml: 0, py: 0.25 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Box
            sx={{
              borderRadius: 1.5,
              border: '1px solid #e0e2e6',
              bgcolor: '#f8f9fa',
              px: 2,
              py: 1.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              After creation, the user receives an email with a link to set their password.
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
        <Button
          onClick={() => onOpenChange(false)}
          sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          disabled={actionLoading || !createUserEmail.trim()}
          onClick={onSubmit}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: BRAND,
            '&:hover': { bgcolor: BRAND_HOVER },
            px: 2.5,
          }}
        >
          Create &amp; send email
        </Button>
      </DialogActions>
    </Dialog>
  );
}
