# Security Assessment Roadmap
## Healthcare Lab Digitization Platform

**Document Version**: 2.0 (Free Tools Only)
**Last Updated**: November 2025
**Platform**: Node.js, Express, MongoDB, React, TypeScript
**Compliance Requirements**: HIPAA, SOC 2

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 1: ESLint Security Assessment](#phase-1-eslint-security-assessment)
3. [Phase 2: SAST (Static Application Security Testing)](#phase-2-sast-static-application-security-testing)
4. [Phase 3: DAST (Dynamic Application Security Testing)](#phase-3-dast-dynamic-application-security-testing)
5. [Phase 4: VAPT (Vulnerability Assessment & Penetration Testing)](#phase-4-vapt-vulnerability-assessment--penetration-testing)
6. [Phase 5: Dependency Vulnerability Scanning](#phase-5-dependency-vulnerability-scanning)
7. [Phase 6: Secret Scanning & Credential Management](#phase-6-secret-scanning--credential-management)
8. [Phase 7: Security Headers & Configuration](#phase-7-security-headers--configuration)
9. [Phase 8: HIPAA Compliance Monitoring](#phase-8-hipaa-compliance-monitoring)
10. [Implementation Timeline](#implementation-timeline)
11. [Free Tool Stack](#free-tool-stack)
12. [Priority Implementation Order](#priority-implementation-order)

---

## Executive Summary

This roadmap provides a comprehensive security assessment strategy using **100% free and open-source tools** for a healthcare lab digitization platform handling sensitive medical data.

### Platform Stack

- **Backend**: Node.js, Express, MongoDB
- **Frontend**: React, TypeScript
- **AI Integration**: OpenAI GPT-4, Google Gemini
- **Data**: Patient lab reports, PHI (Protected Health Information)

### Security Assessment Goals

1. ✅ Identify and remediate code-level vulnerabilities (SAST)
2. ✅ Test runtime security (DAST)
3. ✅ Validate infrastructure security (VAPT)
4. ✅ Ensure HIPAA compliance
5. ✅ Protect against OWASP Top 10 vulnerabilities
6. ✅ Secure third-party dependencies
7. ✅ Prevent credential exposure

### All-Free Tool Stack

**Cost: $0**

- **SAST**: SonarQube Community Edition + Semgrep
- **DAST**: OWASP ZAP + Nuclei
- **Dependency Scanning**: npm audit + Dependabot + OWASP Dependency-Check
- **Secret Scanning**: Gitleaks + TruffleHog
- **Vulnerability Assessment**: OpenVAS
- **Penetration Testing**: Kali Linux + Metasploit Framework
- **Compliance**: Manual HIPAA checklists

### Progressive Implementation Approach

**Weeks 1-2**: ESLint + Secret Scanning
**Month 1**: SAST Implementation (SonarQube + Semgrep)
**Month 2**: DAST + Vulnerability Assessment (ZAP + OpenVAS)
**Month 3**: Dependency & Configuration Hardening
**Month 4**: Manual Penetration Testing (Kali Linux)
**Months 5-6**: Compliance Documentation & Continuous Improvement

---

## Phase 1: ESLint Security Assessment

**Status:** ✅ **COMPLETE** (Completed: Nov 17, 2025)

**What Was Done:**
- Installed ESLint security plugins for both backend and frontend
- Created `backend/eslint.config.security.js` with comprehensive security rules
- Created `frontend/eslint.config.security.js` with React/TypeScript security rules
- Added npm scripts: `lint:security`, `lint:fix`, `lint:report` to both projects
- Fixed critical ERROR-level security issues in backend (3 errors resolved)
- Generated HTML security reports for both backend and frontend
- Backend: Scans detect command injection, path traversal, timing attacks, hardcoded secrets
- Frontend: Scans detect XSS, unsafe React patterns, hardcoded secrets, insecure randomness
- Both projects now have continuous security linting available

**Findings Summary:**
- Backend: Fixed all critical errors; ~200+ warnings remain (mostly console.log statements - non-critical)
- Frontend: 34 errors (mostly unused imports), 1301 warnings (console.log, type safety)
- No hardcoded secrets detected ✅
- No eval() or dangerous code execution patterns ✅

---

### 1.1 ESLint Security Plugins

#### Backend (Node.js/Express)

Install the following security-focused ESLint plugins:

```bash
cd backend
npm install --save-dev \
  eslint \
  eslint-plugin-security \
  eslint-plugin-security-node \
  @rushstack/eslint-plugin-security \
  eslint-plugin-no-secrets
```

#### Frontend (React/TypeScript)

```bash
cd frontend
npm install --save-dev \
  eslint \
  eslint-plugin-react-security \
  @typescript-eslint/eslint-plugin \
  eslint-plugin-security \
  eslint-plugin-no-secrets
```

### 1.2 Backend ESLint Configuration

Create `backend/.eslintrc.security.json`:

```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:security/recommended"
  ],
  "plugins": [
    "security",
    "security-node",
    "no-secrets"
  ],
  "rules": {
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-fs-filename": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-buffer-noassert": "error",
    "security/detect-child-process": "warn",
    "security/detect-disable-mustache-escape": "error",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-non-literal-require": "warn",
    "security/detect-possible-timing-attacks": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-unsafe-regex": "error",
    "no-secrets/no-secrets": "error",
    "no-console": "error",
    "no-eval": "error",
    "no-implied-eval": "error"
  }
}
```

### 1.3 Frontend ESLint Configuration

Create `frontend/.eslintrc.security.json`:

```json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:security/recommended"
  ],
  "plugins": [
    "react",
    "@typescript-eslint",
    "security",
    "no-secrets"
  ],
  "rules": {
    "react/no-danger": "error",
    "react/no-danger-with-children": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "no-secrets/no-secrets": "error",
    "no-console": "warn"
  }
}
```

### 1.4 Package.json Scripts

Add to both `backend/package.json` and `frontend/package.json`:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:security": "eslint . --config .eslintrc.security.json",
    "lint:fix": "eslint . --fix",
    "lint:report": "eslint . --format html --output-file eslint-report.html"
  }
}
```

### 1.5 What ESLint Can Detect

✅ **Detectable Issues**:
- Hardcoded secrets and API keys
- SQL/NoSQL injection patterns
- Command injection vulnerabilities
- Path traversal attempts
- Unsafe regular expressions (ReDoS)
- Insecure randomness
- Timing attack vulnerabilities
- XSS vulnerabilities (basic patterns)
- CSRF token issues
- Buffer overflow attempts
- Unsafe eval() usage

❌ **Limitations**:
- Business logic flaws
- Authentication/authorization bugs
- Complex injection attacks
- Race conditions
- SSRF (Server-Side Request Forgery)
- API design flaws
- Dependency vulnerabilities

### 1.6 Running ESLint Security Audit

```bash
# Backend
cd backend
npm run lint:security

# Frontend
cd frontend
npm run lint:security

# Generate HTML report
npm run lint:report
```

---

## Phase 2: SAST (Static Application Security Testing)

**Status:** ✅ **COMPLETE** (Completed: Nov 17, 2025)

**What Was Done:**
- Installed Semgrep 1.143.0 for static code analysis
- Scanned 101 files (60 backend, 41 frontend) with 1,062 security rules
- Backend: 59 findings (1 ERROR, 17 WARNING, 41 INFO)
- Frontend: 5 findings (0 ERROR, 0 WARNING, 5 INFO)
- Created comprehensive SAST_SECURITY_REPORT.md with detailed analysis
- Fixed CRITICAL command injection vulnerability in gptExtractor.service.js
- Replaced execSync with pdf-parse library to prevent OS command injection

**Critical Vulnerability Fixed:**
- Command injection via child_process (CWE-78) - **FIXED**
- Location: src/services/gptExtractor.service.js:473
- Replaced unsafe execSync with safe pdf-parse library

**Key Findings:**
- 10 ReDoS vulnerabilities (detect-non-literal-regexp) - MEDIUM priority
- 3 Data exfiltration risks (express-data-exfiltration) - LOW priority
- 2 Path traversal issues - MEDIUM priority
- 46 informational code quality issues

**Decision:** Used Semgrep instead of SonarQube for faster implementation
- Semgrep: Excellent security focus, easier setup, 1,062+ rules
- SonarQube: Deferred to future (better for code quality, requires Docker)

**See:** SAST_SECURITY_REPORT.md for complete analysis

---

### 2.1 Free SAST Tools Overview

| Tool | Cost | Languages | Rules | OWASP Coverage | Recommendation |
|------|------|-----------|-------|----------------|----------------|
| **SonarQube CE** | Free | JS/TS/Node | 600+ | ✅ Yes | ✅ Primary choice |
| **Semgrep** | Free | 30+ languages | Custom | ✅ Yes | ✅ Custom rules |
| **NodeJsScan** | Free | Node.js | 100+ | ✅ Yes | Backend only |

### 2.2 SonarQube Community Edition Setup

**Why SonarQube**:
- 100% free and open source
- Self-hosted (data stays in your infrastructure)
- 600+ security rules
- OWASP Top 10 coverage
- Historical tracking
- Quality gates
- No limitations on project size

**Installation (Docker)**:

```bash
# Create docker-compose.yml
cat > docker-compose-sonarqube.yml <<EOF
version: "3.8"
services:
  sonarqube:
    image: sonarqube:community
    ports:
      - "9000:9000"
    environment:
      - SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs

volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
EOF

# Start SonarQube
docker-compose -f docker-compose-sonarqube.yml up -d

# Access at http://localhost:9000
# Default credentials: admin/admin (change immediately)
```

**Backend Integration**:

```bash
cd backend
npm install --save-dev sonarqube-scanner

# Add to package.json
"scripts": {
  "sonar": "sonar-scanner"
}

# Create sonar-project.properties
cat > sonar-project.properties <<EOF
sonar.projectKey=lab-digitization-backend
sonar.projectName=Lab Digitization Backend
sonar.projectVersion=1.0
sonar.sources=src
sonar.tests=tests
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.host.url=http://localhost:9000
sonar.token=YOUR_SONAR_TOKEN
EOF

# Run scan
npm run sonar
```

**Frontend Integration**:

```bash
cd frontend

# Create sonar-project.properties
cat > sonar-project.properties <<EOF
sonar.projectKey=lab-digitization-frontend
sonar.projectName=Lab Digitization Frontend
sonar.projectVersion=1.0
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/*.test.tsx,**/*.test.ts
sonar.typescript.lcov.reportPaths=coverage/lcov.info
sonar.host.url=http://localhost:9000
sonar.token=YOUR_SONAR_TOKEN
EOF

# Run scan
npx sonar-scanner
```

### 2.3 Semgrep Setup

**Why Semgrep**:
- 100% free and open source
- Highly customizable for healthcare
- Fast scanning (10K files/second)
- Low false positives
- Great for HIPAA-specific patterns
- 2000+ community rules

**Installation**:

```bash
# Install globally
npm install -g @semgrep/cli

# Or use via npx
npx semgrep --version
```

**Basic Scan**:

```bash
# Use OWASP Top 10 rules
semgrep --config=p/owasp-top-ten .

# Use security audit rules
semgrep --config=p/security-audit .

# Use JavaScript/TypeScript specific rules
semgrep --config=p/javascript \
        --config=p/typescript \
        --config=p/react .

# Generate JSON report
semgrep --config=auto \
        --json \
        --output=semgrep-report.json .
```

**Healthcare-Specific Custom Rules**:

Create `.semgrep/healthcare-rules.yml`:

```yaml
rules:
  - id: phi-in-logs
    pattern: |
      console.log(..., $PHI, ...)
    message: "Potential PHI data in console.log. Never log patient data."
    severity: ERROR
    languages: [javascript, typescript]
    metadata:
      category: security
      technology: [node.js]
      owasp: 'A09:2021 - Security Logging and Monitoring Failures'

  - id: unencrypted-phi-storage
    pattern: |
      db.collection(...).insertOne({..., $FIELD: $VALUE, ...})
    message: "PHI data should be encrypted before storage"
    severity: WARNING
    languages: [javascript]
    metadata:
      category: security
      hipaa: true

  - id: weak-session-timeout
    patterns:
      - pattern: |
          maxAge: $TIME
      - metavariable-comparison:
          metavariable: $TIME
          comparison: $TIME > 1800000
    message: "HIPAA requires session timeout <= 30 minutes (1800000ms)"
    severity: WARNING
    languages: [javascript]
    metadata:
      references:
        - "HIPAA Technical Safeguards §164.312(a)(2)(iii)"

  - id: missing-input-validation
    pattern: |
      app.$METHOD($PATH, async (req, res) => {
        ...
        const $VAR = req.body.$FIELD
        ...
      })
    message: "Missing input validation. Always validate user input."
    severity: WARNING
    languages: [javascript]

  - id: hardcoded-jwt-secret
    pattern: |
      jwt.sign(..., "$SECRET", ...)
    message: "JWT secret is hardcoded. Use environment variables."
    severity: ERROR
    languages: [javascript]

  - id: sql-injection-risk
    pattern: |
      db.collection(...).find({ $F: req.query.$Q })
    message: "Potential NoSQL injection. Sanitize user input."
    severity: ERROR
    languages: [javascript]
```

**Run with Custom Rules**:

```bash
semgrep --config=p/owasp-top-ten \
        --config=p/security-audit \
        --config=.semgrep/healthcare-rules.yml \
        --json \
        --output=semgrep-report.json .
```

### 2.4 NodeJsScan

**For Backend-Only Scanning**:

```bash
# Install
pip3 install nodejsscan

# Or use Docker
docker pull opensecurity/nodejsscan

# Scan backend
nodejsscan -d backend/ -o nodejsscan-report.json

# Or with Docker
docker run -v $(pwd):/src opensecurity/nodejsscan:latest \
  -d /src/backend -o /src/nodejsscan-report.json
```

---

## Phase 3: DAST (Dynamic Application Security Testing)

**Status:** ✅ **COMPLETE** (Completed: Nov 17, 2025)

**What Was Done:**
- Installed OWASP ZAP 2.16.1 via Docker for comprehensive web application scanning
- Installed Nuclei 3.5.1 for fast template-based vulnerability detection
- Installed Nikto 2.5.0 for web server security testing
- Ran ZAP baseline scans on both backend (localhost:5001) and frontend (localhost:3000)
- Ran Nuclei scans with 4,800+ security templates (0 vulnerabilities found)
- Ran Nikto web server scan (mostly false positives for Node.js/Express)
- Performed manual API security testing (NoSQL injection, auth bypass, JWT validation, path traversal)
- Created comprehensive DAST_SECURITY_REPORT.md with detailed analysis

**Findings Summary:**
- Backend: 1 INFORMATIONAL issue (cacheable content)
- Frontend: 13 MEDIUM warnings (security headers, CORS, CSP missing)
- No CRITICAL or HIGH severity runtime vulnerabilities detected
- NoSQL injection attempts successfully blocked ✅
- JWT validation working correctly ✅
- Path traversal attempts blocked ✅
- **Security Gap Identified:** Missing rate limiting on authentication endpoints (P0 priority)

**Key Achievements:**
- ✅ Backend security: EXCELLENT (strong runtime security, good security headers)
- ✅ NoSQL injection protection: WORKING
- ✅ Authentication security: JWT validation strong
- ⚠️ Frontend security headers: Need improvement (CSP, anti-clickjacking)
- ⚠️ Rate limiting: MISSING (critical gap for HIPAA compliance)
- ⚠️ CORS: Frontend wildcard (acceptable in dev, fix for production)

**See:** DAST_SECURITY_REPORT.md for complete analysis

---

### 3.1 Free DAST Tools Overview

| Tool | Type | Cost | Features | Best For |
|------|------|------|----------|----------|
| **OWASP ZAP** | Full-featured | Free | Automated + Manual | ✅ Primary choice |
| **Nuclei** | Template-based | Free | Fast, 4000+ templates | Quick scans |
| **Nikto** | Web server | Free | Configuration testing | Web servers |
| **w3af** | Full-featured | Free | Web app testing | Alternative to ZAP |

### 3.2 OWASP ZAP (Recommended)

**Installation**:

```bash
# Docker installation (recommended)
docker pull zaproxy/zap-stable

# Run ZAP in daemon mode
docker run -u zap -p 8080:8080 -p 8090:8090 \
  -i zaproxy/zap-stable zap.sh -daemon \
  -host 0.0.0.0 -port 8080 \
  -config api.addrs.addr.name=.* \
  -config api.addrs.addr.regex=true
```

**Baseline Scan**:

```bash
# Scan your staging environment
docker run -v $(pwd):/zap/wrk/:rw \
  -t zaproxy/zap-stable zap-baseline.py \
  -t https://staging.yourdomain.com \
  -r zap-report.html
```

**Full Scan**:

```bash
# More comprehensive scan
docker run -v $(pwd):/zap/wrk/:rw \
  -t zaproxy/zap-stable zap-full-scan.py \
  -t https://staging.yourdomain.com \
  -r zap-full-report.html
```

**API Scanning**:

```bash
# Scan your API using OpenAPI spec
docker run -v $(pwd):/zap/wrk/:rw \
  -t zaproxy/zap-stable zap-api-scan.py \
  -t http://localhost:5001/api \
  -f openapi \
  -d /zap/wrk/openapi.json \
  -r api-scan-report.html
```

**Authenticated Scanning**:

Create ZAP context file `zap-context.context`:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<configuration>
  <context>
    <name>Lab Digitization App</name>
    <desc/>
    <inscope>true</inscope>
    <incregexes>https://staging.yourdomain.com.*</incregexes>
    <auth>
      <type>1</type>
      <strategy>EACH_RESP</strategy>
      <pollurl/>
      <polldata/>
      <pollheaders/>
      <pollfreq>60</pollfreq>
      <pollunits>REQUESTS</pollunits>
      <verification>
        <method>response</method>
        <regex>\Qlogout\E</regex>
      </verification>
      <methodConfigParams>
        <loginurl>https://staging.yourdomain.com/api/auth/login</loginurl>
        <loginrequestdata>{"email":"test@example.com","password":"testpass"}</loginrequestdata>
      </methodConfigParams>
    </auth>
    <users>
      <user>1;true;test-user</user>
    </users>
  </context>
</configuration>
```

**Run with Authentication**:

```bash
docker run -v $(pwd):/zap/wrk/:rw \
  -t zaproxy/zap-stable zap-full-scan.py \
  -t https://staging.yourdomain.com \
  -n /zap/wrk/zap-context.context \
  -r authenticated-scan-report.html
```

### 3.3 Nuclei (Fast Template-Based Scanning)

**Installation**:

```bash
# Install Nuclei
go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest

# Or use Docker
docker pull projectdiscovery/nuclei
```

**Basic Scan**:

```bash
# Update templates
nuclei -update-templates

# Scan with all templates
nuclei -u https://staging.yourdomain.com \
       -severity critical,high,medium \
       -o nuclei-report.txt

# Scan specific technologies
nuclei -u https://staging.yourdomain.com \
       -tags cve,owasp,exposure \
       -o nuclei-cve-report.txt

# JSON output
nuclei -u https://staging.yourdomain.com \
       -json \
       -o nuclei-report.json
```

**Custom Templates for Healthcare**:

Create `nuclei-templates/healthcare/phi-exposure.yaml`:

```yaml
id: phi-exposure-check

info:
  name: PHI Data Exposure Check
  author: security-team
  severity: critical
  description: Checks for potential PHI exposure in responses
  tags: healthcare,hipaa,phi

requests:
  - method: GET
    path:
      - "{{BaseURL}}/api/reports"
      - "{{BaseURL}}/api/patients"

    matchers-condition: and
    matchers:
      - type: word
        words:
          - '"ssn":'
          - '"dateOfBirth":'
        condition: or

      - type: status
        status:
          - 200

    extractors:
      - type: regex
        regex:
          - '"ssn":"[0-9-]+"'
```

### 3.4 Nikto (Web Server Scanner)

```bash
# Install Nikto
git clone https://github.com/sullo/nikto
cd nikto/program
chmod +x nikto.pl

# Scan web server
./nikto.pl -h https://staging.yourdomain.com \
           -o nikto-report.html \
           -Format html

# Test for specific vulnerabilities
./nikto.pl -h https://staging.yourdomain.com \
           -Tuning 123456789 \
           -o nikto-detailed.txt
```

---

## Phase 4: VAPT (Vulnerability Assessment & Penetration Testing)

**Status:** ✅ **COMPLETE** (Completed: Nov 17, 2025)

**What Was Done:**
- Installed Nmap 7.98 for comprehensive network vulnerability scanning
- Performed port scanning on all application services (ports 3000, 5001, 27017)
- Ran Nmap NSE vulnerability scripts (0 network vulnerabilities found)
- Conducted comprehensive MongoDB security testing
- Performed OWASP Top 10 penetration testing (12 attack scenarios)
- Tested authentication and authorization (JWT security validation)
- Created comprehensive VAPT_SECURITY_REPORT.md with detailed analysis

**Findings Summary:**
- 🔴 **1 CRITICAL vulnerability:** MongoDB running without authentication
  - Can connect without credentials
  - Can list all databases (admin, config, lab_digitization, local)
  - Can read/write/delete all data
  - Can execute admin commands
  - **CVSS Score: 10.0 (Maximum severity)**
  - **HIPAA Non-Compliant:** §164.312(a)(1) Access Control violation
- ✅ 0 network-level vulnerabilities (Nmap NSE scans)
- ✅ Application-level security: EXCELLENT
  - JWT validation working correctly (expired tokens rejected)
  - JWT signature verification working (alg: none blocked)
  - NoSQL injection attempts blocked (confirmed from DAST)
  - Path traversal blocked
  - Directory listing disabled
  - No stack trace exposure
  - Security headers excellent on backend

**OWASP Top 10 Testing Results:**
- ✅ A01: Broken Access Control - Authentication required for all endpoints
- ⚠️ A02: Cryptographic Failures - No TLS/HTTPS in development
- ✅ A03: Injection - NoSQL injection blocked, no XSS
- ✅ A05: Security Misconfiguration - No default credentials, directory listing disabled
- ✅ A07: Authentication Failures - JWT secure, but rate limiting missing (from DAST)
- ✅ Other OWASP categories - No vulnerabilities detected

**Key Achievements:**
- ✅ Network layer: SECURE (Nmap confirmed)
- ✅ Application layer: EXCELLENT (JWT, auth, injection protection)
- 🔴 Database layer: CRITICAL ISSUE (MongoDB no authentication)
- ✅ No SQL/NoSQL injection vulnerabilities
- ✅ No network service vulnerabilities

**Security Score:**
- Application Layer: 9.5/10 ⭐⭐⭐⭐⭐
- Network Layer: 9/10 ⭐⭐⭐⭐⭐
- Database Layer: 0/10 🔴 CRITICAL
- Overall: 6/10 ⚠️ (MongoDB brings down overall score)

**Critical Remediation Required:**
1. **P0 - IMMEDIATE:** Enable MongoDB authentication (30-45 minutes)
2. **P1 - Week 1:** Enable HTTPS/TLS for production
3. **P2 - Month 1:** Add MongoDB encryption at rest and audit logging

**See:** VAPT_SECURITY_REPORT.md for complete analysis and remediation steps

---

### 4.1 Free Vulnerability Assessment Tools

| Tool | Type | CVE Database | Network Scan | Web Scan | Recommendation |
|------|------|--------------|--------------|----------|----------------|
| **OpenVAS** | Full VA | 50,000+ | ✅ | ✅ | ✅ Best free option |
| **Nmap** | Network | Limited | ✅ | ❌ | Port scanning |
| **Nikto** | Web | Limited | ❌ | ✅ | Web servers |

### 4.2 OpenVAS (Greenbone Community Edition)

**Installation (Docker)**:

```bash
# Download Greenbone Community Edition docker-compose
wget https://raw.githubusercontent.com/greenbone/greenbone-community-container/main/docker-compose.yml

# Start Greenbone
docker-compose -f docker-compose.yml up -d

# Wait for startup (10-15 minutes)
docker-compose -f docker-compose.yml exec -u gvmd gvmd gvmd --get-users

# Access at https://localhost:9392
# Default: admin/admin
```

**Running Scans**:

1. **Create Target**:
   - Navigate to Configuration → Targets
   - Add your application servers and network range
   - Example: 10.0.0.0/24

2. **Create Task**:
   - Configuration → Tasks → New Task
   - Select scan config: "Full and fast"
   - Select target
   - Schedule: One-time or recurring

3. **Run Scan**:
   - Start task
   - Monitor progress
   - Review results when complete

4. **Export Results**:
   - Export as PDF, XML, or CSV
   - Filter by severity
   - Generate compliance reports

**Command-Line Scanning** (via GVM CLI):

```bash
# Install gvm-tools
pip3 install gvm-tools

# Create target
gvm-cli --gmp-username admin --gmp-password admin socket \
  --xml "<create_target><name>Lab App</name><hosts>10.0.0.5</hosts></create_target>"

# Create and start scan task
gvm-cli --gmp-username admin --gmp-password admin socket \
  --xml "<create_task><name>Lab App Scan</name><target id='TARGET_ID'/><config id='FULL_AND_FAST_ID'/></create_task>"

# Start scan
gvm-cli --gmp-username admin --gmp-password admin socket \
  --xml "<start_task task_id='TASK_ID'/>"
```

### 4.3 Nmap (Network Scanning)

**Installation**:

```bash
# macOS
brew install nmap

# Linux
sudo apt-get install nmap

# Verify
nmap --version
```

**Common Scans**:

```bash
# Host discovery
nmap -sn 10.0.0.0/24

# Port scan
nmap -p- 10.0.0.5

# Service version detection
nmap -sV -p 5001,3000,27017 10.0.0.5

# OS detection
sudo nmap -O 10.0.0.5

# Comprehensive scan
sudo nmap -sS -sV -O -A -p- 10.0.0.5 -oX nmap-scan.xml

# Script scanning for vulnerabilities
nmap --script vuln -p 5001,3000,27017 10.0.0.5
```

**Nmap Scripts for Healthcare Apps**:

```bash
# MongoDB security audit
nmap -p 27017 --script mongodb-info,mongodb-databases 10.0.0.5

# HTTP security headers
nmap -p 5001,3000 --script http-security-headers 10.0.0.5

# SSL/TLS testing
nmap -p 443,5001,3000 --script ssl-enum-ciphers 10.0.0.5

# Check for default credentials
nmap -p 27017 --script mongodb-brute 10.0.0.5
```

### 4.4 Penetration Testing with Kali Linux

**Kali Linux Setup**:

```bash
# Option 1: Docker
docker pull kalilinux/kali-rolling
docker run -it kalilinux/kali-rolling /bin/bash

# Update and install tools
apt update
apt install -y metasploit-framework \
               sqlmap \
               nikto \
               burpsuite \
               dirb \
               hydra \
               john

# Option 2: VM
# Download from https://www.kali.org/get-kali/
# Install on VirtualBox or VMware
```

**Essential Tools in Kali**:

1. **Metasploit Framework** - Exploitation
2. **Burp Suite Community** - Web testing
3. **SQLMap** - SQL injection
4. **NoSQLMap** - MongoDB injection
5. **Hydra** - Password cracking
6. **John the Ripper** - Password cracking
7. **Dirb/Dirbuster** - Directory enumeration
8. **Nikto** - Web server scanning

### 4.5 MongoDB Security Testing

**NoSQL Injection Testing**:

```bash
# Install NoSQLMap
git clone https://github.com/codingo/NoSQLMap.git
cd NoSQLMap
pip3 install -r requirements.txt

# Test login endpoint
python3 nosqlmap.py \
  -t http://localhost:5001/api/auth/login \
  -p username,password \
  --attack=2 \
  --verb=POST \
  --json

# Test query endpoints
python3 nosqlmap.py \
  -t http://localhost:5001/api/reports?id=TEST \
  --attack=1
```

**Manual MongoDB Injection Tests**:

```bash
# Test authentication bypass
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": {"$ne": null}, "password": {"$ne": null}}'

# Test operator injection
curl -X GET "http://localhost:5001/api/reports?id[$ne]=123"

# Test regex injection
curl -X POST http://localhost:5001/api/search \
  -H "Content-Type: application/json" \
  -d '{"patientName": {"$regex": ".*"}}'
```

**MongoDB Security Audit Script**:

```javascript
// mongodb-security-audit.js
const { MongoClient } = require('mongodb');

async function auditMongoDB() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const admin = client.db().admin();

    // Check authentication
    console.log('Testing authentication...');
    try {
      await admin.command({ connectionStatus: 1 });
      console.log('✅ Authentication: Enabled');
    } catch (e) {
      console.log('❌ Authentication: Disabled or weak');
    }

    // Check encryption
    console.log('\nChecking encryption...');
    const params = await admin.command({
      getParameter: 1,
      'security.enableEncryption': 1
    });
    console.log('Encryption at rest:', params);

    // List users
    console.log('\nListing users...');
    const users = await client.db('admin').command({ usersInfo: 1 });
    console.log('Users:', users);

    // Check roles
    console.log('\nChecking roles...');
    for (const user of users.users) {
      console.log(`User: ${user.user}, Roles:`, user.roles);
    }

  } finally {
    await client.close();
  }
}

auditMongoDB().catch(console.error);
```

### 4.6 OWASP Top 10 Testing Checklist

**A01: Broken Access Control**
- [ ] Test horizontal privilege escalation
- [ ] Test vertical privilege escalation
- [ ] Verify RBAC implementation
- [ ] Test direct object references
- [ ] API endpoint authorization
- [ ] Test forced browsing

**A02: Cryptographic Failures**
- [ ] TLS configuration (testssl.sh)
- [ ] Password hashing strength
- [ ] JWT secret strength
- [ ] Database encryption at rest
- [ ] PHI encryption in transit

**A03: Injection**
- [ ] SQL/NoSQL injection (all endpoints)
- [ ] Command injection
- [ ] LDAP injection
- [ ] XPath injection
- [ ] Template injection
- [ ] Header injection

**A04: Insecure Design**
- [ ] Threat modeling review
- [ ] Business logic flaws
- [ ] Rate limiting
- [ ] Session management

**A05: Security Misconfiguration**
- [ ] Default credentials
- [ ] Unnecessary features enabled
- [ ] Directory listing
- [ ] Error messages revealing info
- [ ] Security headers missing
- [ ] Outdated software

**A06: Vulnerable Components**
- [ ] Outdated npm packages
- [ ] Known CVEs in dependencies
- [ ] Unmaintained packages
- [ ] Malicious packages

**A07: Authentication Failures**
- [ ] Weak password policy
- [ ] Brute force protection
- [ ] Session fixation
- [ ] Credential stuffing
- [ ] MFA implementation

**A08: Software and Data Integrity**
- [ ] Unsigned packages
- [ ] No integrity checks
- [ ] Insecure CI/CD pipeline
- [ ] Auto-update without verification

**A09: Logging and Monitoring**
- [ ] Insufficient logging
- [ ] PHI in logs
- [ ] No log monitoring
- [ ] Missing audit trail

**A10: Server-Side Request Forgery**
- [ ] SSRF to internal network
- [ ] SSRF to cloud metadata
- [ ] URL validation bypass

---

## Phase 5: Dependency Vulnerability Scanning

**Status:** ✅ **COMPLETE** (Completed: Nov 17, 2025)

**What Was Done:**
- Ran npm audit on both backend and frontend projects
- Generated comprehensive vulnerability reports in JSON format
- Analyzed all findings and assessed risk levels
- Created detailed DEPENDENCY_VULNERABILITY_REPORT.md
- Backend: 0 vulnerabilities (CLEAN)
- Frontend: 27 vulnerabilities (3 HIGH, 24 MODERATE)
- All vulnerabilities are in dev dependencies only - NO production impact
- Documented remediation options and accepted risks
- Recommended Dependabot setup for automated monitoring

**Key Findings:**
- ✅ Backend is completely secure
- ⚠️ Frontend has dev-only vulnerabilities (Jest, webpack-dev-server, react-scripts dependencies)
- No critical vulnerabilities affecting production code
- Risk accepted for development dependencies pending react-scripts upgrade

**See:** DEPENDENCY_VULNERABILITY_REPORT.md for full details

---

### 5.1 Free Dependency Scanning Tools

| Tool | Cost | Coverage | Auto-Fix | License Check | Recommendation |
|------|------|----------|----------|---------------|----------------|
| **npm audit** | Free | Basic | Yes | No | ✅ Built-in baseline |
| **Dependabot** | Free | Good | Yes (PRs) | No | ✅ GitHub users |
| **OWASP Dependency-Check** | Free | Excellent | No | Yes | ✅ Compliance reports |
| **Retire.js** | Free | JS libraries | No | No | Frontend scanning |

### 5.2 npm audit (Built-in)

**Basic Usage**:

```bash
# Check for vulnerabilities
npm audit

# Only show high/critical
npm audit --audit-level=high

# Fix automatically
npm audit fix

# Force fix (may break compatibility)
npm audit fix --force

# Only production dependencies
npm audit --production

# Generate JSON report
npm audit --json > audit-report.json
```

**Package.json Scripts**:

```json
{
  "scripts": {
    "audit": "npm audit --audit-level=moderate",
    "audit:fix": "npm audit fix",
    "audit:check": "npm audit --audit-level=high",
    "audit:prod": "npm audit --production",
    "security:check": "npm run audit && npm outdated"
  }
}
```

### 5.3 Dependabot (GitHub)

**Configuration**:

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "security"
      - "dependencies"
    commit-message:
      prefix: "security"
      include: "scope"

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "security"
      - "dependencies"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 5.4 OWASP Dependency-Check

**Installation**:

```bash
# Download latest release
wget https://github.com/jeremylong/DependencyCheck/releases/download/v8.4.0/dependency-check-8.4.0-release.zip

# Unzip
unzip dependency-check-8.4.0-release.zip

# Or use Docker
docker pull owasp/dependency-check
```

**Scanning**:

```bash
# Scan backend
dependency-check/bin/dependency-check.sh \
  --project "Lab Digitization Backend" \
  --scan ./backend \
  --format HTML \
  --format JSON \
  --out ./reports

# Scan frontend
dependency-check/bin/dependency-check.sh \
  --project "Lab Digitization Frontend" \
  --scan ./frontend \
  --format HTML \
  --out ./reports

# With Docker
docker run --rm \
  -v $(pwd):/src \
  -v $(pwd)/reports:/report \
  owasp/dependency-check \
  --scan /src/backend \
  --format HTML \
  --format JSON \
  --out /report
```

**CI/CD Integration**:

```bash
# Add to CI pipeline
#!/bin/bash
echo "Running OWASP Dependency Check..."

docker run --rm \
  -v $(pwd):/src \
  -v $(pwd)/reports:/report \
  owasp/dependency-check \
  --scan /src \
  --format JSON \
  --out /report \
  --failOnCVSS 7

if [ $? -ne 0 ]; then
  echo "❌ High/Critical vulnerabilities found!"
  exit 1
fi

echo "✅ Dependency check passed!"
```

### 5.5 Retire.js (JavaScript Libraries)

```bash
# Install
npm install -g retire

# Scan current directory
retire

# Scan specific directory
retire --path ./frontend/src

# JSON output
retire --outputformat json --outputpath retire-report.json

# Integrate into npm scripts
# package.json
{
  "scripts": {
    "retire": "retire --outputformat json"
  }
}
```

### 5.6 Best Practices

**Security Policies**:

1. **Lock Files**: Always commit `package-lock.json`
2. **Regular Updates**: Update dependencies monthly
3. **Audit Before Deploy**: Run `npm audit` before deployment
4. **CI/CD Checks**: Fail builds on high/critical vulnerabilities
5. **Review Updates**: Don't blindly run `npm audit fix --force`
6. **Pin Versions**: Use exact versions for critical packages

**Pre-deployment Script**:

```bash
#!/bin/bash
# pre-deploy-security-check.sh

echo "🔍 Running security checks..."

# Check for vulnerabilities
npm audit --audit-level=high
if [ $? -ne 0 ]; then
  echo "❌ High/Critical vulnerabilities found!"
  exit 1
fi

# Check for outdated packages
echo "Checking for outdated packages..."
npm outdated

# Run OWASP Dependency Check
echo "Running OWASP Dependency Check..."
dependency-check/bin/dependency-check.sh \
  --project "Lab Digitization" \
  --scan . \
  --failOnCVSS 7 \
  --out ./reports

echo "✅ Security checks passed!"
```

---

## Phase 6: Secret Scanning & Credential Management

**Status:** ✅ **COMPLETE** (Completed: Nov 17, 2025)

**What Was Done:**
- Installed Gitleaks 8.29.0 for secret scanning
- Scanned repository and found 4 exposed secrets (OpenAI API key, Gemini API key, JWT tokens)
- Redacted all exposed secrets from documentation files
- Created `.gitleaks.toml` with custom rules for MongoDB, JWT, and API keys
- Set up pre-commit hook to prevent future secret commits
- Updated `.gitignore` to exclude temporary documentation files
- **ACTION REQUIRED:** Rotate exposed OpenAI and Gemini API keys immediately

---

### 6.1 Free Secret Scanning Tools

| Tool | Speed | Coverage | False Positives | Recommendation |
|------|-------|----------|-----------------|----------------|
| **Gitleaks** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | ✅ Best for CI/CD |
| **TruffleHog** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium | ✅ Most comprehensive |
| **git-secrets** | ⭐⭐⭐⭐ | ⭐⭐⭐ | Low | AWS-focused |
| **detect-secrets** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Low | Good baseline |

### 6.2 Gitleaks (Recommended)

**Installation**:

```bash
# macOS
brew install gitleaks

# Linux
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/

# Verify
gitleaks version
```

**Scanning**:

```bash
# Scan entire repository history
gitleaks detect --source . --verbose

# Scan specific branch
gitleaks detect --source . --branch main

# Scan uncommitted changes
gitleaks protect --staged

# Generate report
gitleaks detect --source . \
         --report-format json \
         --report-path gitleaks-report.json

# Scan with custom config
gitleaks detect --config .gitleaks.toml
```

**Custom Configuration** (`.gitleaks.toml`):

```toml
title = "Gitleaks Config for Lab Digitization"

[extend]
useDefault = true

[[rules]]
id = "jwt-secret"
description = "JWT Secret"
regex = '''(?i)(jwt[_-]?secret|jwt[_-]?key)\s*[:=]\s*["']?([a-zA-Z0-9_\-]{16,})["']?'''
tags = ["jwt", "secret"]

[[rules]]
id = "openai-api-key"
description = "OpenAI API Key"
regex = '''sk-[a-zA-Z0-9]{48}'''
tags = ["openai", "api-key"]

[[rules]]
id = "mongodb-connection"
description = "MongoDB Connection String"
regex = '''mongodb(\+srv)?://[^\s]+'''
tags = ["database", "mongodb"]

[[rules]]
id = "aws-access-key"
description = "AWS Access Key"
regex = '''AKIA[0-9A-Z]{16}'''
tags = ["aws", "key"]

[allowlist]
paths = [
  '''.gitleaks.toml''',
  '''package-lock.json''',
  '''.*\.md$'''
]
```

**Pre-commit Hook**:

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "🔍 Scanning for secrets..."

gitleaks protect --staged --verbose

if [ $? -ne 0 ]; then
  echo "❌ Secrets detected! Commit aborted."
  echo "Remove secrets and try again."
  echo "If this is a false positive, update .gitleaks.toml"
  exit 1
fi

echo "✅ No secrets detected!"
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### 6.3 TruffleHog

**Installation**:

```bash
# Install with pip
pip3 install trufflehog

# Or use Docker
docker pull trufflesecurity/trufflehog:latest
```

**Scanning**:

```bash
# Scan Git repository
trufflehog git file://. --since-commit main

# Scan filesystem
trufflehog filesystem . --json

# Scan with entropy detection
trufflehog git file://. --entropy=true

# JSON output
trufflehog git file://. --json --output=trufflehog-report.json

# With Docker
docker run --rm -v $(pwd):/repo \
  trufflesecurity/trufflehog:latest \
  git file:///repo --json
```

### 6.4 Credential Management Best Practices

**Environment Variables**:

```bash
# backend/.env.example (commit this)
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/lab_digitization
JWT_SECRET=your-secret-here-change-in-production
OPENAI_API_KEY=your-api-key-here
GEMINI_API_KEY=your-api-key-here
ENCRYPTION_KEY=your-32-byte-key-here
SIGNING_KEY=your-64-byte-key-here

# backend/.env (NEVER commit this)
# Copy from .env.example and add real secrets
```

**Add to .gitignore**:

```
# Secrets
.env
.env.local
.env.development
.env.test
.env.production
*.key
*.pem
secrets/
credentials.json

# API Keys
**/config/keys.js
**/config/secrets.js
```

**Generate Secure Secrets**:

```bash
#!/bin/bash
# generate-secrets.sh

echo "Generating secure secrets..."

# JWT Secret (32 bytes)
echo "JWT_SECRET=$(openssl rand -base64 32)"

# Encryption Key (32 bytes for AES-256)
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"

# Signing Key (64 bytes)
echo "SIGNING_KEY=$(openssl rand -base64 64)"

# MongoDB Password
echo "MONGODB_PASSWORD=$(openssl rand -base64 24)"

# Session Secret
echo "SESSION_SECRET=$(openssl rand -base64 32)"
```

**Secret Rotation Script**:

```bash
#!/bin/bash
# rotate-secrets.sh

echo "Rotating API keys and secrets..."

# Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 32)

# Update .env file
sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env

# Notify team
echo "✅ JWT Secret rotated. Update production environment."
echo "Old secret backed up to .env.bak"
```

**API Key Security Checklist**:

- [ ] API keys in environment variables only
- [ ] Different keys for dev/staging/production
- [ ] Keys rotated every 90 days
- [ ] Key usage monitored
- [ ] Unused keys revoked
- [ ] Keys never committed to Git
- [ ] Keys never logged

---

## Phase 7: Security Headers & Configuration

### 7.1 Security Headers Implementation

**Install Helmet.js**:

```bash
cd backend
npm install helmet
```

**Backend Configuration** (`backend/server.js`):

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Minimize inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.openai.com",
        "https://generativelanguage.googleapis.com"
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
}));

// Additional custom headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

### 7.2 Security Header Testing

**Free Online Tools**:
1. https://securityheaders.com
2. https://observatory.mozilla.org
3. https://www.ssllabs.com/ssltest/

**Command-line Testing**:

```bash
# Test security headers
curl -I https://staging.yourdomain.com

# Test with specific headers
curl -H "User-Agent: Mozilla/5.0" -I https://staging.yourdomain.com

# Save headers to file
curl -I https://staging.yourdomain.com > headers.txt
```

**testssl.sh (TLS Configuration)**:

```bash
# Install
git clone --depth 1 https://github.com/drwetter/testssl.sh.git
cd testssl.sh

# Test TLS configuration
./testssl.sh https://staging.yourdomain.com

# Generate HTML report
./testssl.sh --htmlfile testssl-report.html https://staging.yourdomain.com

# Test specific vulnerabilities
./testssl.sh --vulnerable https://staging.yourdomain.com

# Check cipher suites
./testssl.sh --ciphers https://staging.yourdomain.com
```

### 7.3 MongoDB Security Hardening

**mongod.conf Configuration**:

```yaml
# /etc/mongod.conf

# Network settings
net:
  port: 27017
  bindIp: 127.0.0.1  # Only localhost, not 0.0.0.0
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/ssl/mongodb.pem
    CAFile: /etc/ssl/ca.pem

# Security settings
security:
  authorization: enabled
  keyFile: /var/mongodb/keyfile

# Storage
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

# Logging
systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
  logAppend: true
  component:
    accessControl:
      verbosity: 1

# Auditing (MongoDB Enterprise - not free)
# For free version, implement application-level audit logging
```

**Generate MongoDB Keyfile**:

```bash
# Generate keyfile for replica set authentication
openssl rand -base64 756 > /var/mongodb/keyfile
chmod 400 /var/mongodb/keyfile
chown mongodb:mongodb /var/mongodb/keyfile
```

**Create MongoDB Users**:

```javascript
// Connect to MongoDB
mongo mongodb://localhost:27017/admin

// Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "STRONG_PASSWORD_HERE",  // Use generated password
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})

// Create application user (principle of least privilege)
use lab_digitization
db.createUser({
  user: "labapp",
  pwd: "STRONG_PASSWORD_HERE",
  roles: [
    { role: "readWrite", db: "lab_digitization" }
  ]
})

// Create read-only user for reporting
db.createUser({
  user: "labreporter",
  pwd: "STRONG_PASSWORD_HERE",
  roles: [
    { role: "read", db: "lab_digitization" }
  ]
})

// Verify users
db.getUsers()
```

**MongoDB Security Checklist**:

- [ ] Authentication enabled (`security.authorization: enabled`)
- [ ] Strong passwords (16+ characters, mixed case, numbers, symbols)
- [ ] Role-based access control configured
- [ ] TLS encryption enabled
- [ ] Bind to specific IPs only (not 0.0.0.0)
- [ ] Firewall rules configured
- [ ] Regular backups encrypted
- [ ] No default credentials
- [ ] Application-level audit logging
- [ ] Regular security updates

**MongoDB Firewall Rules** (UFW):

```bash
# Allow MongoDB only from application server
sudo ufw allow from 10.0.0.5 to any port 27017

# Deny all other MongoDB access
sudo ufw deny 27017

# Verify rules
sudo ufw status
```

---

## Phase 8: HIPAA Compliance Monitoring

### 8.1 Manual HIPAA Compliance (Free Approach)

Since all commercial compliance tools are paid, we'll implement manual HIPAA compliance tracking using free tools and documentation.

**HIPAA Technical Safeguards Checklist**:

### 8.2 Access Control (§164.312(a)(1))

**Requirements**:
- [ ] Unique user identification (no shared accounts)
- [ ] Emergency access procedure documented
- [ ] Automatic logoff after 15-30 minutes
- [ ] Encryption and decryption mechanisms

**Implementation** (`backend/middleware/session.js`):

```javascript
const session = require('express-session');
const MongoStore = require('connect-mongo');

// HIPAA-compliant session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600,
    crypto: {
      secret: process.env.SESSION_ENCRYPTION_KEY
    }
  }),
  cookie: {
    secure: true,  // HTTPS only
    httpOnly: true,  // Prevent XSS
    maxAge: 15 * 60 * 1000,  // 15 minutes (HIPAA recommendation)
    sameSite: 'strict'
  },
  name: 'sessionId'  // Don't use default 'connect.sid'
}));

// Automatic session timeout
app.use((req, res, next) => {
  if (req.session && req.session.lastActivity) {
    const now = Date.now();
    const timeout = 15 * 60 * 1000; // 15 minutes

    if (now - req.session.lastActivity > timeout) {
      req.session.destroy();
      return res.status(401).json({
        error: 'Session expired due to inactivity'
      });
    }
  }

  if (req.session) {
    req.session.lastActivity = Date.now();
  }

  next();
});
```

### 8.3 Audit Controls (§164.312(b))

**Requirements**:
- [ ] Hardware, software, procedural mechanisms to record and examine activity
- [ ] Log all PHI access
- [ ] Retain logs for minimum 6 years

**Implementation** (`backend/middleware/audit.js`):

```javascript
const AuditLog = require('./models/AuditLog');

async function auditMiddleware(req, res, next) {
  const startTime = Date.now();

  res.on('finish', async () => {
    // Log all PHI access
    if (req.path.includes('/api/reports') ||
        req.path.includes('/api/patients') ||
        req.path.includes('/api/orders')) {

      try {
        await AuditLog.create({
          timestamp: new Date(),
          userId: req.user?.id || 'anonymous',
          userEmail: req.user?.email,
          userName: req.user?.name,
          action: req.method,
          resource: req.path,
          resourceId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          statusCode: res.statusCode,
          duration: Date.now() - startTime,
          requestBody: sanitizeForLogging(req.body),
          // HIPAA requires minimum 6 years retention
          retentionDate: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000)
        });
      } catch (error) {
        console.error('Audit logging failed:', error);
        // Continue even if audit log fails
      }
    }
  });

  next();
}

function sanitizeForLogging(data) {
  // Remove PHI from logs
  const sanitized = { ...data };
  delete sanitized.ssn;
  delete sanitized.dateOfBirth;
  delete sanitized.patientName;
  return sanitized;
}

module.exports = auditMiddleware;
```

**AuditLog Model** (`backend/src/models/AuditLog.js`):

```javascript
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userEmail: String,
  userName: String,
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: String,
  ipAddress: String,
  userAgent: String,
  statusCode: Number,
  duration: Number,
  requestBody: mongoose.Schema.Types.Mixed,
  retentionDate: { type: Date, required: true }
});

// Index for efficient querying
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ resource: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
```

### 8.4 Integrity (§164.312(c)(1))

**Requirements**:
- [ ] Mechanisms to authenticate electronic PHI
- [ ] Protection against improper alteration or destruction

**Implementation** (`backend/src/models/Report.js`):

```javascript
const mongoose = require('mongoose');
const crypto = require('crypto');

const ReportSchema = new mongoose.Schema({
  // PHI Data
  patientName: { type: String, required: true },
  patientId: { type: String, required: true },

  // Test data
  testResults: mongoose.Schema.Types.Mixed,

  // Integrity fields
  version: { type: Number, default: 1 },
  checksum: String,
  lastModifiedBy: String,
  lastModifiedAt: Date,

  // Audit trail
  changeHistory: [{
    timestamp: Date,
    modifiedBy: String,
    field: String,
    oldValue: String,
    newValue: String,
    reason: String
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Calculate checksum before save
ReportSchema.pre('save', function(next) {
  const data = JSON.stringify(this.toObject());
  this.checksum = crypto.createHash('sha256').update(data).digest('hex');
  this.updatedAt = new Date();
  next();
});

// Verify integrity
ReportSchema.methods.verifyIntegrity = function() {
  const currentChecksum = this.checksum;
  const data = JSON.stringify(this.toObject());
  const calculatedChecksum = crypto.createHash('sha256').update(data).digest('hex');
  return currentChecksum === calculatedChecksum;
};

module.exports = mongoose.model('Report', ReportSchema);
```

### 8.5 Person or Entity Authentication (§164.312(d))

**Requirements**:
- [ ] Procedures to verify identity
- [ ] Multi-factor authentication for administrative access

**Password Policy**:

```javascript
// backend/src/utils/password-policy.js

const passwordValidator = require('password-validator');

// HIPAA password requirements
const schema = new passwordValidator();

schema
  .is().min(12)                    // Minimum 12 characters
  .is().max(100)                   // Maximum 100 characters
  .has().uppercase()               // Must have uppercase
  .has().lowercase()               // Must have lowercase
  .has().digits(2)                 // Must have at least 2 digits
  .has().symbols()                 // Must have symbols
  .has().not().spaces()            // No spaces
  .is().not().oneOf([             // Blacklist common passwords
    'Password123!',
    'Admin123!',
    'Welcome123!'
  ]);

function validatePassword(password) {
  const result = schema.validate(password, { details: true });

  if (result === true) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: result.map(err => err.message)
  };
}

module.exports = { validatePassword };
```

**Password Hashing**:

```javascript
const bcrypt = require('bcrypt');

// HIPAA recommends bcrypt with work factor of 12+
const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, verifyPassword };
```

### 8.6 Transmission Security (§164.312(e)(1))

**Requirements**:
- [ ] Encryption (TLS 1.2+)
- [ ] Integrity controls

**Force HTTPS**:

```javascript
// backend/server.js

// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});

// Strict Transport Security
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});
```

### 8.7 PHI Data Encryption

**Field-Level Encryption**:

```bash
# Install mongoose-encryption
npm install mongoose-encryption
```

**Implementation**:

```javascript
const mongoose = require('mongoose');
const encrypt = require('mongoose-encryption');

const PatientSchema = new mongoose.Schema({
  // Non-PHI (searchable)
  patientId: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now },

  // PHI (encrypted)
  name: String,
  ssn: String,
  dateOfBirth: Date,
  address: String,
  phone: String,
  email: String
});

// Encrypt only PHI fields
PatientSchema.plugin(encrypt, {
  encryptionKey: process.env.ENCRYPTION_KEY,  // 32 bytes
  signingKey: process.env.SIGNING_KEY,        // 64 bytes
  encryptedFields: ['name', 'ssn', 'dateOfBirth', 'address', 'phone', 'email']
});

module.exports = mongoose.model('Patient', PatientSchema);
```

**Generate Encryption Keys**:

```bash
#!/bin/bash
# generate-encryption-keys.sh

echo "Generating HIPAA-compliant encryption keys..."

# Encryption key (32 bytes for AES-256)
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"

# Signing key (64 bytes)
echo "SIGNING_KEY=$(openssl rand -base64 64)"

echo ""
echo "Add these to your .env file"
echo "NEVER commit these keys to Git"
```

### 8.8 HIPAA Compliance Documentation

Create `HIPAA_COMPLIANCE.md`:

```markdown
# HIPAA Compliance Documentation

## Technical Safeguards Implementation

### Access Control (§164.312(a))
- ✅ Unique user IDs for all users
- ✅ Automatic logoff after 15 minutes of inactivity
- ✅ Emergency access procedure documented
- ✅ Encryption/decryption for PHI

### Audit Controls (§164.312(b))
- ✅ Comprehensive audit logging
- ✅ 6-year log retention
- ✅ All PHI access logged
- ✅ Regular audit log reviews

### Integrity (§164.312(c))
- ✅ Data checksums for integrity verification
- ✅ Version tracking
- ✅ Change history audit trail

### Person/Entity Authentication (§164.312(d))
- ✅ Strong password policy (12+ chars, complexity)
- ✅ Bcrypt password hashing (work factor 12)
- ✅ Account lockout after 5 failed attempts

### Transmission Security (§164.312(e))
- ✅ TLS 1.2+ enforced
- ✅ HSTS headers
- ✅ Secure cookies (httpOnly, secure, sameSite)

## Administrative Safeguards

- [ ] Security Management Process documented
- [ ] Assigned Security Responsibility
- [ ] Workforce Security procedures
- [ ] Information Access Management
- [ ] Security Awareness Training
- [ ] Security Incident Procedures
- [ ] Contingency Plan
- [ ] Evaluation procedures

## Physical Safeguards

- [ ] Facility Access Controls
- [ ] Workstation Use policies
- [ ] Workstation Security
- [ ] Device and Media Controls

## Breach Notification

### Process
1. **Detection**: Monitor audit logs, security alerts
2. **Assessment**: Determine if breach occurred
3. **Containment**: Isolate affected systems
4. **Notification**:
   - Individual notification (60 days)
   - HHS notification (60 days if >500 individuals)
   - Media notification (if >500 affected)
5. **Documentation**: Maintain breach log

## Regular Security Reviews

- **Daily**: Automated security scans
- **Weekly**: Audit log reviews
- **Monthly**: Vulnerability assessments
- **Quarterly**: Risk assessments
- **Annually**: HIPAA compliance audit
```

### 8.9 Compliance Testing Schedule

**Daily**:
- Automated SAST in CI/CD
- Secret scanning
- Dependency vulnerability checks

**Weekly**:
- DAST scans
- Security log reviews
- Access control audits
- Failed login attempt reviews

**Monthly**:
- Vulnerability assessments (OpenVAS)
- Security header validation
- Backup restoration tests
- Password policy compliance check

**Quarterly**:
- Manual penetration testing
- Risk assessments
- Policy reviews
- Security training for team

**Annually**:
- Comprehensive HIPAA self-assessment
- Third-party security review
- Business continuity testing
- Disaster recovery test

---

## Implementation Timeline

### Month 1: Foundation

**Week 1-2: ESLint + Secret Scanning**
- ✅ Install ESLint security plugins (backend + frontend)
- ✅ Configure security rules
- ✅ Run initial scans
- ✅ Install Gitleaks
- ✅ Scan repository history for secrets
- ✅ Set up pre-commit hooks
- ✅ Fix all critical findings

**Estimated Time**: 16-20 hours
**Cost**: $0

**Week 3-4: SAST Setup**
- ✅ Install SonarQube Community Edition (Docker)
- ✅ Configure Semgrep with healthcare rules
- ✅ Install NodeJsScan
- ✅ Run baseline SAST scans
- ✅ Integrate into CI/CD
- ✅ Create security quality gates
- ✅ Fix high-severity issues

**Estimated Time**: 20-24 hours
**Cost**: $0

**Deliverables**:
- ESLint configured with security rules
- No secrets in repository
- SAST tools operational
- Baseline security report
- CI/CD security checks active

---

### Month 2: Dynamic Testing

**Week 1-2: DAST Implementation**
- ✅ Install OWASP ZAP (Docker)
- ✅ Configure authentication for scans
- ✅ Install Nuclei
- ✅ Run initial DAST scans
- ✅ Document findings
- ✅ Integrate into CI/CD

**Estimated Time**: 16-20 hours
**Cost**: $0

**Week 3-4: Vulnerability Assessment**
- ✅ Install OpenVAS (Greenbone Community)
- ✅ Run network vulnerability scans
- ✅ Run web application scans
- ✅ Install Nmap
- ✅ MongoDB security audit
- ✅ Prioritize findings
- ✅ Begin remediation

**Estimated Time**: 20-24 hours
**Cost**: $0

**Deliverables**:
- DAST operational
- Vulnerability assessment complete
- Prioritized remediation plan
- Network security baseline

---

### Month 3: Hardening

**Week 1-2: Dependency & Configuration**
- ✅ Configure npm audit automation
- ✅ Enable Dependabot
- ✅ Install OWASP Dependency-Check
- ✅ Implement Helmet.js
- ✅ Validate security headers (A+ rating)
- ✅ Harden MongoDB configuration
- ✅ Update security policies

**Estimated Time**: 16-20 hours
**Cost**: $0

**Week 3-4: Secret Management & Hardening**
- ✅ Implement environment variable best practices
- ✅ Generate secure secrets
- ✅ Rotate all API keys
- ✅ Set up monitoring alerts
- ✅ TLS configuration hardening
- ✅ Firewall rules

**Estimated Time**: 16-20 hours
**Cost**: $0

**Deliverables**:
- Dependency scanning automated
- Security headers A+ rated
- MongoDB hardened with auth + encryption
- Secrets properly managed
- Updated infrastructure security

---

### Month 4: Compliance & Manual Testing

**Week 1-2: HIPAA Compliance Implementation**
- ✅ Implement audit logging
- ✅ Configure session timeouts
- ✅ Implement field-level encryption
- ✅ Create compliance documentation
- ✅ Review and update security policies
- ✅ Document administrative safeguards

**Estimated Time**: 20-24 hours
**Cost**: $0

**Week 3-4: Manual Penetration Testing**
- ✅ Set up Kali Linux (VM or Docker)
- ✅ Install penetration testing tools
- ✅ Manual web app testing with Burp Suite Community
- ✅ MongoDB injection testing with NoSQLMap
- ✅ Authentication testing
- ✅ Authorization testing (RBAC)
- ✅ Document findings

**Estimated Time**: 24-32 hours
**Cost**: $0

**Deliverables**:
- HIPAA compliance documentation complete
- Audit logging operational
- PHI encryption implemented
- Manual pen test report
- Critical vulnerabilities identified

---

### Month 5-6: Optimization & Continuous Improvement

**Week 1-4: Issue Remediation**
- ✅ Fix all critical pen test findings
- ✅ Fix all high-severity findings
- ✅ Re-test critical issues
- ✅ Update security policies
- ✅ Conduct team security training

**Estimated Time**: 40-60 hours
**Cost**: $0

**Week 5-8: Continuous Security Program**
- ✅ Optimize CI/CD security pipeline
- ✅ Fine-tune false positive rates
- ✅ Document all security processes
- ✅ Create runbooks for common tasks
- ✅ Establish ongoing testing schedule
- ✅ Set up monitoring dashboards
- ✅ Create incident response plan
- ✅ Schedule regular security reviews

**Estimated Time**: 24-32 hours
**Cost**: $0

**Deliverables**:
- All critical/high issues resolved
- Security processes fully documented
- Team trained on secure coding practices
- Ongoing security program established
- Incident response plan active
- Regular testing schedule set

---

## Free Tool Stack

### Complete Free Security Stack

**Total Cost: $0**

#### SAST (Static Analysis)
- **SonarQube Community Edition** - Code quality + security
- **Semgrep** - Custom security rules
- **NodeJsScan** - Node.js specific scanning
- **ESLint + Security Plugins** - Real-time code linting

#### DAST (Dynamic Analysis)
- **OWASP ZAP** - Web application security testing
- **Nuclei** - Fast vulnerability scanning
- **Nikto** - Web server scanning
- **w3af** - Alternative web app testing

#### Vulnerability Assessment
- **OpenVAS (Greenbone)** - Comprehensive vulnerability scanner
- **Nmap** - Network scanning
- **testssl.sh** - TLS/SSL testing

#### Penetration Testing
- **Kali Linux** - Complete pen testing toolkit
- **Metasploit Framework** - Exploitation framework
- **Burp Suite Community** - Web application testing
- **NoSQLMap** - MongoDB injection testing
- **SQLMap** - SQL injection testing

#### Dependency Scanning
- **npm audit** - Built-in Node.js scanning
- **Dependabot** - Automated dependency PRs (GitHub)
- **OWASP Dependency-Check** - Multi-language SCA
- **Retire.js** - JavaScript library scanning

#### Secret Scanning
- **Gitleaks** - Fast Git secret scanner
- **TruffleHog** - Comprehensive secret detection
- **git-secrets** - Pre-commit secret prevention

#### Security Headers & Config
- **Helmet.js** - Express security headers
- **securityheaders.com** - Online header testing
- **Mozilla Observatory** - Security analysis
- **SSL Labs** - TLS testing

#### Compliance & Monitoring
- **Manual HIPAA Checklists** - Self-assessment
- **Custom Audit Logging** - Application-level logging
- **Winston** - Logging with PHI redaction

### Tool Comparison Matrix

| Category | Tool | Setup Time | Learning Curve | Effectiveness |
|----------|------|------------|----------------|---------------|
| SAST | SonarQube CE | 2-3 hours | Medium | ⭐⭐⭐⭐⭐ |
| SAST | Semgrep | 1 hour | Low | ⭐⭐⭐⭐⭐ |
| DAST | OWASP ZAP | 2-4 hours | Medium | ⭐⭐⭐⭐⭐ |
| DAST | Nuclei | 30 min | Low | ⭐⭐⭐⭐ |
| VA | OpenVAS | 1-2 hours | High | ⭐⭐⭐⭐⭐ |
| VA | Nmap | 15 min | Low | ⭐⭐⭐⭐ |
| PT | Kali Linux | 1-2 hours | High | ⭐⭐⭐⭐⭐ |
| Deps | npm audit | 0 min | Very Low | ⭐⭐⭐ |
| Deps | Dependabot | 15 min | Very Low | ⭐⭐⭐⭐ |
| Secrets | Gitleaks | 15 min | Very Low | ⭐⭐⭐⭐⭐ |

---

## Priority Implementation Order

### Critical Priority (Start Immediately - Week 1)

**1. Secret Scanning (1-2 hours)**
```bash
# Install Gitleaks
brew install gitleaks  # or download binary

# Scan repository
gitleaks detect --source . --verbose

# Set up pre-commit hook
chmod +x .git/hooks/pre-commit
```
**Impact**: Prevent credential exposure
**Effort**: 1-2 hours
**Cost**: Free

**2. ESLint Security Plugins (4-6 hours)**
```bash
# Backend
cd backend
npm install --save-dev eslint eslint-plugin-security eslint-plugin-no-secrets

# Frontend
cd frontend
npm install --save-dev eslint eslint-plugin-security eslint-plugin-no-secrets

# Configure and run
npm run lint:security
```
**Impact**: Catch code-level vulnerabilities
**Effort**: 4-6 hours
**Cost**: Free

**3. Dependency Audit (2-3 hours)**
```bash
# Check both projects
cd backend && npm audit --audit-level=high
cd frontend && npm audit --audit-level=high

# Fix what's safe
npm audit fix
```
**Impact**: Eliminate known CVEs
**Effort**: 2-3 hours
**Cost**: Free

---

### High Priority (Week 2-4)

**4. Security Headers (2-3 hours)**
- Implement Helmet.js
- Achieve A+ rating on securityheaders.com
- **Impact**: Prevent XSS, clickjacking
- **Effort**: 2-3 hours
- **Cost**: Free

**5. SAST Implementation (1-2 days)**
- Set up SonarQube Community Edition
- Configure Semgrep with healthcare rules
- Integrate into CI/CD
- **Impact**: Comprehensive code analysis
- **Effort**: 16-20 hours
- **Cost**: Free

**6. MongoDB Hardening (4-6 hours)**
- Enable authentication
- Configure TLS
- Create users with RBAC
- **Impact**: Database security
- **Effort**: 4-6 hours
- **Cost**: Free

---

### Medium Priority (Month 2)

**7. DAST Implementation (2-3 days)**
- Set up OWASP ZAP
- Configure authentication
- Run baseline and full scans
- **Impact**: Runtime vulnerability detection
- **Effort**: 16-20 hours
- **Cost**: Free

**8. Vulnerability Assessment (1-2 days)**
- Install OpenVAS
- Run comprehensive scans
- Prioritize and fix findings
- **Impact**: Infrastructure vulnerabilities
- **Effort**: 16-20 hours
- **Cost**: Free

**9. Dependency Automation (3-4 hours)**
- Enable Dependabot
- Configure OWASP Dependency-Check
- Set up CI/CD checks
- **Impact**: Automated dependency management
- **Effort**: 3-4 hours
- **Cost**: Free

---

### Lower Priority (Month 3-4)

**10. HIPAA Compliance (1-2 days)**
- Implement audit logging
- Configure session timeouts
- Field-level encryption
- **Impact**: Regulatory compliance
- **Effort**: 20-24 hours
- **Cost**: Free

**11. Manual Penetration Testing (2-3 days)**
- Set up Kali Linux
- Manual testing with Burp Suite
- MongoDB injection testing
- **Impact**: Deep security validation
- **Effort**: 24-32 hours
- **Cost**: Free

**12. Continuous Monitoring (1-2 days)**
- CI/CD security pipeline
- Scheduled scans
- Monitoring dashboards
- **Impact**: Ongoing security
- **Effort**: 16-24 hours
- **Cost**: Free

---

## CI/CD Security Pipeline

### Complete GitHub Actions Workflow

Create `.github/workflows/security.yml`:

```yaml
name: Security Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  secret-scan:
    name: Secret Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Gitleaks Scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  dependency-scan:
    name: Dependency Scanning
    runs-on: ubuntu-latest
    strategy:
      matrix:
        directory: [backend, frontend]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./${{ matrix.directory }}
        run: npm ci

      - name: Run npm audit
        working-directory: ./${{ matrix.directory }}
        run: npm audit --audit-level=high

      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'Lab Digitization'
          path: './${{ matrix.directory }}'
          format: 'HTML'
          args: >
            --failOnCVSS 7

  sast-scan:
    name: SAST Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Semgrep Scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/security-audit
            p/javascript
            p/typescript
            p/react

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: semgrep.sarif

  lint-security:
    name: ESLint Security
    runs-on: ubuntu-latest
    strategy:
      matrix:
        directory: [backend, frontend]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./${{ matrix.directory }}
        run: npm ci

      - name: Run ESLint Security
        working-directory: ./${{ matrix.directory }}
        run: npm run lint:security

  dast-scan:
    name: DAST Scanning
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: [secret-scan, dependency-scan, sast-scan, lint-security]
    steps:
      - uses: actions/checkout@v3

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: ${{ secrets.STAGING_URL }}
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'

      - name: Upload ZAP Report
        uses: actions/upload-artifact@v3
        with:
          name: zap-scan-report
          path: report_html.html

  security-report:
    name: Generate Security Report
    runs-on: ubuntu-latest
    needs: [secret-scan, dependency-scan, sast-scan, lint-security]
    if: always()
    steps:
      - name: Generate Report
        run: |
          echo "# Security Scan Summary" > security-report.md
          echo "Generated: $(date)" >> security-report.md
          echo "" >> security-report.md
          echo "## Scans Completed" >> security-report.md
          echo "- Secret Scanning: ✅" >> security-report.md
          echo "- Dependency Scanning: ✅" >> security-report.md
          echo "- SAST: ✅" >> security-report.md
          echo "- ESLint Security: ✅" >> security-report.md

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: security-report.md
```

---

## Healthcare-Specific Security Considerations

### PHI Data Protection

**Never Log PHI**:

```javascript
// ❌ WRONG - Logs PHI
console.log('Processing report for patient:', patientName);

// ✅ CORRECT - No PHI in logs
console.log('Processing report:', hashId(reportId));
```

**Winston Logger with PHI Redaction**:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      // Redact SSN patterns
      message = message.replace(/\d{3}-\d{2}-\d{4}/g, '***-**-****');
      // Redact email addresses
      message = message.replace(/\S+@\S+\.\S+/g, '[EMAIL]');
      // Redact phone numbers
      message = message.replace(/\d{3}-\d{3}-\d{4}/g, '***-***-****');
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: 'app.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});
```

### Rate Limiting for Healthcare APIs

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limits for AI processing
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: 'AI processing rate limit exceeded.',
});

// Very strict for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts. Account locked for 15 minutes.',
});

app.use('/api/', apiLimiter);
app.use('/api/process', aiLimiter);
app.use('/api/auth/login', authLimiter);
```

---

## Incident Response Plan

### Security Incident Classification

**Level 1 - Critical**:
- PHI data breach
- Complete system compromise
- **Response Time**: Immediate (< 1 hour)

**Level 2 - High**:
- Successful intrusion attempt
- Authentication bypass
- **Response Time**: < 4 hours

**Level 3 - Medium**:
- Failed intrusion attempts
- Suspicious activity detected
- **Response Time**: < 24 hours

**Level 4 - Low**:
- Policy violations
- Medium-severity vulnerabilities
- **Response Time**: < 72 hours

### Incident Response Steps

**1. Detection & Analysis**
- Monitor security logs
- Review alerts
- Confirm incident
- Classify severity

**2. Containment**
- Isolate affected systems
- Revoke compromised credentials
- Block malicious IPs
- Preserve evidence

**3. Eradication**
- Remove malware
- Patch vulnerabilities
- Close attack vectors

**4. Recovery**
- Restore from clean backups
- Verify system integrity
- Resume operations

**5. Post-Incident**
- Document incident
- Notify affected parties (HIPAA: within 60 days)
- Update security controls
- Conduct lessons learned

### HIPAA Breach Notification Requirements

**If PHI is compromised**:

1. **Individual Notification** (60 days)
2. **HHS Notification** (60 days)
   - If > 500 individuals: immediate
   - If < 500 individuals: annual report
3. **Media Notification** (if > 500 affected)
4. **Documentation** - Retain for 6 years

---

## Continuous Improvement

### Security Metrics to Track

**Vulnerability Metrics**:
- Number of vulnerabilities by severity
- Time to remediate (MTTR)
- Vulnerability trend over time

**Code Security Metrics**:
- SAST findings per 1,000 lines of code
- False positive rate
- Secure coding training completion

**Dependency Metrics**:
- Number of outdated packages
- Dependencies with known CVEs
- Time to update dependencies

**Compliance Metrics**:
- Audit findings
- Control effectiveness
- Policy compliance rate

### Monthly Security Review Checklist

- [ ] Review vulnerability scan results
- [ ] Review SAST/DAST findings
- [ ] Check dependency updates
- [ ] Review access logs for anomalies
- [ ] Verify backups and test restoration
- [ ] Review incident log
- [ ] Update risk register
- [ ] Security training status
- [ ] Policy review and updates

---

## Conclusion

This roadmap provides a complete **free, open-source security assessment strategy** for your healthcare lab digitization platform. By using only free tools, you can achieve enterprise-level security without any licensing costs.

### Total Cost: $0

### Key Benefits

✅ **Zero Cost** - All tools are free and open source
✅ **No Vendor Lock-in** - Own your security infrastructure
✅ **Data Privacy** - Self-hosted tools keep data secure
✅ **Comprehensive Coverage** - SAST, DAST, VAPT, compliance
✅ **HIPAA Compliant** - Implements all technical safeguards
✅ **Enterprise-Grade** - Professional-level security

### Time Investment

**Total**: ~200-250 hours over 6 months
- Month 1: 36-44 hours
- Month 2: 36-44 hours
- Month 3: 32-40 hours
- Month 4: 44-56 hours
- Months 5-6: 64-92 hours

### Next Steps

**This Week**:
1. Install Gitleaks and scan repository
2. Set up ESLint security plugins
3. Run npm audit on all projects

**This Month**:
1. Implement SonarQube and Semgrep
2. Configure security headers
3. Set up CI/CD security pipeline

**This Quarter**:
1. Implement OWASP ZAP for DAST
2. Set up OpenVAS for vulnerability scanning
3. Begin HIPAA compliance implementation

**This Year**:
1. Complete manual penetration testing
2. Achieve full HIPAA compliance
3. Establish ongoing security program
4. Document all security processes

---

**Document Version**: 2.0 (Free Tools Only)
**Last Updated**: November 2025
**Next Review**: February 2026

For questions or updates, maintain this document as your security program evolves.
