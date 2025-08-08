# PocketLLM

Follow the steps below to set up and run the project.

## Backend Setup

1. **Install dependencies**:
   <pre>
   <code>pip3 install -r requirements.txt</code>
   </pre>

2. **Edit main.spec**:
   Navigate to the `backend` folder and open `main.spec`. You need to make changes in two places:

   a. **Langchain Package Location**: [Check this post](https://github.com/langchain-ai/langchain/issues/4547#issuecomment-1676403768)
      <pre>
      <code>a.datas += Tree('<text style="color: red;">/path/to/langchain</text>', prefix='langchain')</code>
      </pre>
      Replace `/path/to/langchain` with your `langchain` location. You can find it by running:
      <pre>
      <code>pip show langchain</code>
      </pre>

   b. **Langchain Community Package Location**
      <pre>
      <code>a.datas += Tree('<text style="color: red;">/path/to/langchain_community</text>', prefix='langchain_community')</code>
      </pre>
      Replace `/path/to/langchain_community` with your `langchain_community` location. You can find it by running:
      <pre>
      <code>pip show langchain_community</code>
      </pre>
      
   c. **NLTK's Stopwords Location**:
      Make sure you have downloaded nltk's stopwords:
      <pre>
      <code>import nltk</code>
      <code>nltk.download('stopwords')</code>
      </pre>
      Then, modify the path in:
      <pre>
      <code>a.datas += Tree('<span style="color: red;">/path/to/nltk/stopwords</span>', prefix='nltk_data/corpora/stopwords')</code>
      </pre>
      Replace `/path/to/nltk/stopwords` with your nltk's stopwords location.

   d. **Trafilatura Package Location**:
      <pre>
      <code>a.datas += Tree('<text style="color: red;">/path/to/trafilatura</text>', prefix='trafilatura')</code>
      </pre>
      Replace `/path/to/trafilatura` with your `trafilatura` location. You can find it by running:
      <pre>
      <code>pip show trafilatura</code>
      </pre>

4. **Compile the Backend**:
   <pre>
      <code>which pyinstaller // *** Always double check if pyinstaller is from conda env you want </code>
      <code>pyinstaller main.spec</code> 
   </pre>
   This will create a folder named `dist/main`.

6. **Copy the Backend to Frontend**:
   Copy the `main` folder from `dist` to the `frontend` directory, ensuring it is at the same level as `package.json`.

   > **Note**: If you need to work with the backend alone, running `python main.py` or `./dist/main` is sufficient. It's a good debugging practice to use `curl` and `websocat` without involving the frontend if you're certain the problem lies in the backend.

## Frontend Setup

1. **Navigate to the frontend directory**:
   <pre>
   <code>cd frontend/pocketllm</code>
   </pre>

2. **Install NPM dependencies**:
   <pre>
   <code>npm i</code>
   </pre>

3. **Run the Frontend**:
   <pre>
   <code>npm run dev</code>
   </pre>

## Distribution Setup
1. **Hide Frontend Debug Console**:
   Go to `/frontend/pocketllm/electron/main.ts`, uncomment following line. This disables user from openning debug console using `cmd+option+i`.
   <pre>
   <code>Menu.setApplicationMenu(Menu.buildFromTemplate([]));</code>
   </pre>

### Mac-arm64
2. **Sign Python Binaries**:
   Before notarizing, it's essential to ensure all executable Python binaries are signed. Typically, the Python binaries are inside the `main` folder, which was compiled using PyInstaller.
   
   Navigate to where the Python binaries are:
   <pre>
   <code>cd path/to/dist/main</code>
   </pre>
   
   First, make the `sign_all.sh` script executable:
   <pre>
   <code>chmod +x sign_all.sh</code>
   </pre>
   
   Now, run the script to sign all Python binaries:
   <pre>
   <code>./sign_all.sh</code>
   </pre>

3. **Package the Frontend**:
   <pre>
   <code>npm run build</code>
   </pre>
   This will generate a `dist` folder in the frontend, containing both the `.dmg` and `.app` files.

   > **Note**: This step could take more than 10mins, so if you are only debugging frontend and and want to shorten build cycle, consider temporarily deleting `frontend/pocketllm/main` containing backend python binaries.

4. **Notarization**:
   Before notarizing, ensure all executable python binaries are signed. Then, move to the `dist` folder in the frontend:
   <pre>
   <code>cd path/to/frontend/pocketllm/dist</code>
   </pre>
   Execute the following to submit for notarization (Replace `pocketllm.zip` with actual name of the zip file like `pocketllm0-0-0.zip`):
   <pre>
   <code>xcrun notarytool submit pocketllm.zip --keychain-profile "AC_PASSWORD" --wait</code>
   </pre>
   Once notarized, attach the ticket to your software using the stapler tool:
   <pre>
   <code>xcrun stapler staple pocketllm.app</code>
   </pre>
> **Note**: Notarization produces a ticket that tells Gatekeeper that your app is notarized. After notarization completes, the next time any user attempts to run your app on macOS 10.14 or later, Gatekeeper finds the ticket online. This includes users who downloaded your app before notarization. Whereas stapler ensures that Apple Gatekeeper can find the ticket even when a network connection isn’t available. [Check this post](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow#3178137)

### Mac-intel
   2. In `frontend/pocketllm/package.json`, change `"repo": "pocketllm-release"`  to `"repo": "pocketllm-release-mac-intel"`
   3. Everything else same as Mac-arm64

### Windows
   2. **Package the Frontend**:
      Same as Mac
   3. Rename `/dist/PocketLLM Setup.exe` to `/dist/PocketLLM-Setup.exe` (replace all in-between space with hyphen)
   4. Submit to [link](https://www.microsoft.com/en-us/wdsi/filesubmission) fill out the form.

## Third‑Party Licenses and Notices

PocketLLM depends on many third‑party packages.  Most dependencies are MIT‑licensed, which do **not** require attribution.  However, several dependencies use copyleft or attribution‑preserving licenses that impose specific obligations.  This section summarises these licenses and the obligations they impose.  See the included `THIRD_PARTY_NOTICES.txt` for full license texts.

- **Apache 2.0:** Many backend and frontend packages (including `requests`, `aiohttp`, `huggingface_hub`, `tokenizers`, `bcrypt`, `swagger-client` and `@tauri-apps/api`) are licensed under Apache 2.0.  This permissive license allows commercial use but requires that you include a copy of the license and any NOTICE files in your distribution:contentReference[oaicite:1]{index=1}.  You must also document any modifications to the original packages:contentReference[oaicite:2]{index=2}.

- **BSD 3‑Clause:** Core scientific libraries (`numpy`, `pandas`, `scikit‑learn`, `shapely`) and some frontend packages (e.g. `protobufjs`) use the BSD 3‑Clause license.  Redistributions must retain the copyright notice, license conditions and disclaimer:contentReference[oaicite:3]{index=3}.

- **LGPL v3:** The PostgreSQL driver `psycopg2-binary` is licensed under the GNU LGPL v3 with an OpenSSL exception.  You may link it to proprietary code, but any changes to the library itself must be released under the LGPL:contentReference[oaicite:4]{index=4}.

- **AGPL v3:** `PyMuPDF` is licensed under the GNU Affero GPL v3.  If you make the application available over a network, you must provide the complete corresponding source code to users:contentReference[oaicite:5]{index=5}.  If you cannot meet the AGPL requirements, you need a commercial PyMuPDF license:contentReference[oaicite:6]{index=6}.

- **GPL v3:** `PyQt6` is released under GPL v3 with a commercial option:contentReference[oaicite:7]{index=7}.  Using the GPL version requires your entire application to be released under GPL v3 and the source code to be made available.  If that is not acceptable, purchase a commercial PyQt6 license.

- **Proprietary:** The `thirdai` library is proprietary.  According to its PyPI page, you need a valid license from ThirdAI to use it:contentReference[oaicite:8]{index=8}, and their documentation notes that you must supply a license file at runtime:contentReference[oaicite:9]{index=9}.  Do not redistribute ThirdAI binaries or code without permission.