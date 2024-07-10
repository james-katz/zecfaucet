import styled, { keyframes } from "styled-components";

export const Container = styled.div`
  max-width: 800px; 
  margin: 0 auto;
  padding: 20px;
  text-align: center;

  @media screen and (max-width: 768px) {
    padding: 10px;
  }
`;

export const ToggleButton = styled.button`
 display: flex;
  align-items: center;
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: inherit;
  transition: color 0.3s ease;

  svg {
    margin-right: 5px;
    font-size: 20px;
  }

  &:hover {
    color: #007bff; 
  }
`;

export const Header = styled.h1`
  font-size: 2em;
  margin-top: 20px;

  @media screen and (max-width: 768px) {
    font-size: 1.5em;
  }
  
`;

const rotate = keyframes`
  from {
    transform: rotateY(0deg);
  }
  to {
    transform: rotateY(360deg);
  }
`;

export const Image = styled.img`
 max-width: 100%;
  height: auto;
  border-radius: 50%;
  animation: ${rotate} 10s linear infinite;
`;

export const Description = styled.p`
  font-size: 1em;

@media screen and (max-width: 768px) {
  font-size: 0.8em;
}
`;

export const Row = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  
`;

export const Column = styled.div`
  flex: 1;
  margin: 10px;
`;

export const WidgetContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  @media screen and (max-width: 768px) {
    flex-direction: column;
  }
`;
