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

   b. **NLTK's Stopwords Location**:
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

   c. **Trafilatura Package Location**:
      <pre>
      <code>a.datas += Tree('<text style="color: red;">/path/to/trafilatura</text>', prefix='trafilatura')</code>
      </pre>
      Replace `/path/to/trafilatura` with your `trafilatura` location. You can find it by running:
      <pre>
      <code>pip show trafilatura</code>
      </pre>

4. **Compile the Backend**:
   <pre>
   <code>pyinstaller main.spec</code>
   </pre>
   This will create a folder named `dist/main`.

5. **Copy the Backend to Frontend**:
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

1. **Sign Python Binaries**:
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

2. **Package the Frontend**:
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
