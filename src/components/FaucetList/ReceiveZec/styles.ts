import styled from "styled-components";



export const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
`;

export const Heading = styled.h3`
  font-size: 1.5rem;
  margin-bottom: 1rem;
`;

export const SubHeading = styled.h5`
  font-size: 1rem;
  margin-bottom: 0.5rem;
`;

export const Paragraph = styled.p`
  font-size: 0.9rem;
  margin-bottom: 1rem;

  a {
    color: #007bff;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

export const P = styled.p`
   font-weight: bold;

   a {
    color: #007bff;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`

export const Input = styled.input`
  width: 100%;
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;

  @media screen and (max-width: 768px) {
    width: 90%;
  }
`;

export const Button = styled.button`
  padding: 0.5rem 1rem;
  font-size: 1.5rem;
  background-color: #ffd700; 
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s, transform 0.1s;

  &:hover {
    background-color: #ffcc00; 
  }

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;


export const Message = styled.div`
  font-size: 0.9rem;
  color: #dc3545;
  margin-bottom: 1rem;
`;

export const SuccessMessage = styled(Message)`
  color: #28a745;
`;


export const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;