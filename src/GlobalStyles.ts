import { createGlobalStyle } from 'styled-components';

interface ContainerProps {
  darkMode: boolean;
}

const GlobalStyle = createGlobalStyle<ContainerProps>`
   

  body {
    background-color: ${props => (props.darkMode ? '#333' : '#fff')};
    color: ${props => (props.darkMode ? '#fff' : '#000')};
  margin: 0;
  font-family: 'Montserrat', sans-serif; 
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: 'Fira Code', monospace; 
}



body::-webkit-scrollbar {
  width: 12px;
}

body::-webkit-scrollbar-thumb {
  background-color: #6d6c6c;
  border-radius: 6px;
}

body::-webkit-scrollbar-track {
  background-color: #3a3a3a;
}

body::-moz-scrollbar {
  width: 12px;
}

body::-moz-scrollbar-thumb {
  background-color: #6d6c6c;
  border-radius: 6px;
}

body::-moz-scrollbar-track {
  background-color: #3a3a3a;
}

`;

export default GlobalStyle;