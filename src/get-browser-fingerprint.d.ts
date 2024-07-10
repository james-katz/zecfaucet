declare module 'get-browser-fingerprint' {
    type Options = {
      hardwareOnly?: boolean;
      enableWebgl?: boolean;
      debug?: boolean;
    };
  
    function getBrowserFingerprint(options?: Options): string;
  
    export = getBrowserFingerprint;
  }
  