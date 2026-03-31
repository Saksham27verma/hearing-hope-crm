'use client';

import React, { useState } from 'react';
import BusinessIcon from '@mui/icons-material/Business';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import KeyIcon from '@mui/icons-material/Key';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';
import { normalizeCenterId } from '@/lib/tenant/centerScope';

export type DirectoryUser = {
  /** Firestore document ID */
  uid: string;
  /** Firebase Auth UID (presence + “You”) */
  firebaseAuthUid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff' | 'audiologist';
  allowedModules?: string[];
  centerId?: string | null;
  branchId?: string | null;
  isSuperAdmin?: boolean;
};

function shortCenterId(id: string) {
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const pulse = keyframes`
  0% {
    transform: scale(0.85);
    opacity: 0.55;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
`;

const CARD = {
  elevation: 0,
  border: '1px solid #e0e2e6',
  boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.03)',
  bgcolor: '#ffffff',
  borderRadius: 2,
  overflow: 'hidden',
};

const BRAND = '#0d9488';
const BRAND_HOVER = '#0f766e';

type Props = {
  users: DirectoryUser[];
  centers: Array<{ id: string; name: string }>;
  onlineMap: Record<string, boolean>;
  currentUserId?: string | null;
  usersLoading: boolean;
  scopeKey: string;
  onAddUser: () => void;
  onAccess: (u: DirectoryUser) => void;
  onPassword: (u: DirectoryUser) => void;
  onEmail: (u: DirectoryUser) => void;
  onReset: (u: DirectoryUser) => void;
  onDelete: (u: DirectoryUser) => void;
};

export default function UserDirectoryTable({
  users,
  centers,
  onlineMap,
  currentUserId,
  usersLoading,
  scopeKey,
  onAddUser,
  onAccess,
  onPassword,
  onEmail,
  onReset,
  onDelete,
}: Props) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; user: DirectoryUser } | null>(null);
  const closeMenu = () => setMenu(null);

  return (
    <Paper sx={{ ...CARD, mt: 4 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'flex-start' },
          justifyContent: 'space-between',
          gap: 2,
          px: 3,
          py: 3,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              border: '1px solid #e0e2e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#fff',
              boxShadow: '0px 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <GroupOutlinedIcon sx={{ color: 'text.primary', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              User directory
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420 }}>
              Filtered by Data scope. Presence updates in real time.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          disableElevation
          startIcon={<AddIcon />}
          onClick={onAddUser}
          sx={{
            bgcolor: BRAND,
            textTransform: 'none',
            fontWeight: 600,
            px: 2.5,
            py: 1,
            borderRadius: 1.5,
            '&:hover': { bgcolor: BRAND_HOVER },
          }}
        >
          Add user
        </Button>
      </Box>

      <TableContainer>
        <Table size="medium" sx={{ borderCollapse: 'separate' }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  borderBottom: '1px solid #e8eaed',
                  bgcolor: '#fafbfc',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  py: 1.5,
                },
              }}
            >
              <TableCell>User</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Role</TableCell>
              <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Center</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" sx={{ width: 56, pr: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Actions
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody key={scopeKey}>
            {usersLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell colSpan={5} sx={{ borderBottom: '1px solid #f0f0f0', py: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: 1.5 }} />
                        <Box sx={{ flex: 1 }}>
                          <Skeleton width="35%" height={20} sx={{ mb: 1 }} />
                          <Skeleton width="55%" height={16} />
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              : users.map((u, idx) => {
                  const centerKey = normalizeCenterId(u);
                  const centerLabel = centerKey
                    ? (centers.find((c) => c.id === centerKey)?.name ?? centerKey)
                    : null;
                  const isSelf = u.firebaseAuthUid === currentUserId;
                  const online = Boolean(onlineMap[u.firebaseAuthUid]);
                  const roleLabel =
                    u.role === 'admin' ? 'Admin' : u.role === 'audiologist' ? 'Audiologist' : 'Staff';
                  const stripe = idx % 2 === 1;

                  return (
                    <TableRow
                      key={u.uid}
                      hover
                      sx={{
                        bgcolor: stripe ? 'rgba(248,249,250,0.85)' : '#ffffff',
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background-color 0.15s ease',
                        '&:hover': { bgcolor: 'rgba(13,148,136,0.06)' },
                      }}
                    >
                      <TableCell sx={{ py: 2.25, pl: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }} noWrap>
                            {u.displayName || u.email}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {u.email}
                          </Typography>
                          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                            <Box
                              component="span"
                              sx={{
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                bgcolor: '#f0f0f0',
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {roleLabel}
                            </Box>
                            {isSelf ? (
                              <Box
                                component="span"
                                sx={{
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 1,
                                  border: '1px solid #e0e2e6',
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                You
                              </Box>
                            ) : null}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, verticalAlign: 'middle' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'flex-start' }}>
                          <Typography
                            variant="caption"
                            sx={{
                              px: 1.25,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: '#f0f2f5',
                              fontWeight: 600,
                              color: 'text.primary',
                            }}
                          >
                            {roleLabel}
                          </Typography>
                          {u.role === 'admin' && u.isSuperAdmin ? (
                            <Typography
                              variant="caption"
                              sx={{
                                px: 1.25,
                                py: 0.35,
                                borderRadius: 10,
                                border: '1px solid #b2dfdb',
                                bgcolor: '#e0f2f1',
                                color: '#00695c',
                                fontWeight: 600,
                              }}
                            >
                              Super admin
                            </Typography>
                          ) : null}
                          {isSelf ? (
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                              You
                            </Typography>
                          ) : null}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, verticalAlign: 'middle' }}>
                        {centerKey ? (
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.75,
                              maxWidth: 260,
                              px: 1.25,
                              py: 0.5,
                              borderRadius: 10,
                              border: '1px solid #b2dfdb',
                              bgcolor: '#e0f2f1',
                            }}
                          >
                            <BusinessIcon sx={{ fontSize: 16, color: BRAND }} />
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#00695c' }} noWrap>
                              {centerLabel}
                            </Typography>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10, color: BRAND }}>
                              {shortCenterId(centerKey)}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            All centers
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'middle' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {online ? (
                            <Box sx={{ position: 'relative', width: 10, height: 10 }}>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  inset: 0,
                                  borderRadius: '50%',
                                  bgcolor: BRAND,
                                  animation: `${pulse} 1.8s ease-out infinite`,
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'relative',
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: BRAND,
                                  boxShadow: `0 0 0 3px rgba(13,148,136,0.2)`,
                                }}
                              />
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: '#cfd4dc',
                              }}
                            />
                          )}
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, color: online ? BRAND : 'text.disabled' }}
                          >
                            {online ? 'Online' : 'Offline'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 1 }}>
                        <IconButton
                          size="small"
                          aria-label={`Actions for ${u.email}`}
                          onClick={(e) => setMenu({ anchor: e.currentTarget, user: u })}
                          sx={{
                            color: 'text.secondary',
                            opacity: { xs: 1, md: 0 },
                            '.MuiTableRow-root:hover &': { opacity: 1 },
                          }}
                        >
                          <MoreHorizIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </TableContainer>

      {!usersLoading && users.length === 0 ? (
        <Box
          sx={{
            py: 8,
            px: 3,
            textAlign: 'center',
            borderTop: '1px solid #f0f0f0',
            bgcolor: '#fafbfc',
          }}
        >
          <PersonOutlinedIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
            No users found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 360, mx: 'auto' }}>
            No users match this data scope. Change Data scope above or invite a teammate.
          </Typography>
        </Box>
      ) : null}

      <Menu
        anchorEl={menu?.anchor ?? null}
        open={Boolean(menu)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 216,
              borderRadius: 2,
              border: '1px solid #e0e2e6',
              boxShadow: '0px 8px 24px rgba(0,0,0,0.08)',
            },
          },
        }}
      >
        {menu ? (
          <>
            <MenuItem
              dense
              onClick={() => {
                onAccess(menu.user);
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SettingsOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}>Access &amp; role</ListItemText>
            </MenuItem>
            <MenuItem
              dense
              disabled={menu.user.firebaseAuthUid === currentUserId}
              onClick={() => {
                onPassword(menu.user);
                closeMenu();
              }}
            >
              <ListItemIcon>
                <LockOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}>Password</ListItemText>
            </MenuItem>
            <MenuItem
              dense
              disabled={menu.user.firebaseAuthUid === currentUserId}
              onClick={() => {
                onEmail(menu.user);
                closeMenu();
              }}
            >
              <ListItemIcon>
                <EmailOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}>Email</ListItemText>
            </MenuItem>
            <MenuItem
              dense
              onClick={() => {
                onReset(menu.user);
                closeMenu();
              }}
            >
              <ListItemIcon>
                <KeyIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}>Send reset link</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem
              dense
              disabled={menu.user.firebaseAuthUid === currentUserId}
              onClick={() => {
                onDelete(menu.user);
                closeMenu();
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteOutlineIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 14, fontWeight: 600, color: 'error.main' }}>
                Delete user
              </ListItemText>
            </MenuItem>
          </>
        ) : null}
      </Menu>
    </Paper>
  );
}
