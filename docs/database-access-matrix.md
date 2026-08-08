# Database access matrix

| Capability | Anonymous | Member | Admin API | Service role |
|---|---:|---:|---:|---:|
| Read approved public projects/features | Allow | Allow | Allow | Allow |
| Read raw analytics tables | Deny | Deny | Deny by default | Allow |
| Read aggregate public metrics API | Allow | Allow | Allow | N/A |
| Enumerate approved-user/admin emails | Deny | Deny | Allow | Allow |
| Mutate approved users/admins | Deny | Deny | Allow | Allow |
| Insert newsletter records directly | Deny | Deny | Deny | Allow via API |
| Insert subscription orders | Deny | Deny | Deny | Deny operationally while paused |
| Vote as another user | Deny | Deny | Deny | N/A |
| Toggle own authenticated vote | Deny | Allow through one-argument RPC | Allow as member | Allow |
| Submit constrained anonymous suggestion | Allow through RPC | Deny through anonymous RPC | N/A | Allow |

Verification must test actual 401/403/permission responses and confirm that denied operations make no row changes.
