# Generate self-signed SSL certificate for local development
$certPath = ".\cert"
New-Item -ItemType Directory -Force -Path $certPath

# Generate certificate
$cert = New-SelfSignedCertificate -DnsName "localhost", "10.164.248.60" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(5)

# Export certificate
$certPassword = ConvertTo-SecureString -String "dev123" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "$certPath\localhost.pfx" -Password $certPassword
Export-Certificate -Cert $cert -FilePath "$certPath\localhost.crt"

Write-Host "✅ Certificate generated successfully!" -ForegroundColor Green
Write-Host "Certificate files created in: $certPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Trust the certificate: Import localhost.crt to 'Trusted Root Certification Authorities'" -ForegroundColor White
Write-Host "2. Run: npm install https-localhost -D" -ForegroundColor White
Write-Host "3. Update package.json dev script" -ForegroundColor White
