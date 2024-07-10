import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;
`;

export const Title = styled.h2`
  font-size: 1.5em;
  margin-bottom: 10px;
`;

export const List = styled.div`
  width: 100%;
  overflow-x: auto;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
`;

export const Th = styled.th`
  padding: 5px;
  text-align: left;
    align-items: center;
   
    border-bottom: 5px solid #ddd;
`;

export const Td = styled.td`
  padding: 20px;
  text-align: left;
  border-bottom: 5px solid #ddd;
`;

export const Row = styled.div`
  display: table-row;
    vertical-align: inherit;
    unicode-bidi: isolate;
    border-color: inherit;

  @media (max-width: 600px) {
    font-size: 1.3em;
  }
`;

export const Donations = styled.div`
  font-size: 1.5em;
  margin-bottom: 10px;

  @media (max-width: 600px) {
    font-size: 1.3em;
  }
`;
