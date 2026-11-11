# storage-upload-authorizer

**Method:** POST  
**Authentication:** Supabase user JWT  
**Request contract:** workspace ID, bucket ID, content metadata, original filename  
**Response contract:** upload operation ID, tenant-prefixed object path, short-lived signed upload URL, expiry

The function verifies workspace membership, bucket allowlist, safe filename/type/size constraints, and rate limits. Canonical object paths begin with the workspace ID. The caller must later create/confirm file metadata through the Express control plane; a signed upload alone never makes a document retrievable.

