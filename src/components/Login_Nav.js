import './Navi.css'
import React, { Component } from 'react';
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import { Link } from 'react-router-dom';
import { Nav } from 'react-bootstrap';
import { Navbar } from 'react-bootstrap';
import { NavDropdown } from 'react-bootstrap';
import { Container } from 'react-bootstrap';
import { Modal } from 'react-bootstrap';
import { useState } from 'react';
import { Dropdown } from 'react-bootstrap';




export const Login_Nav = (props) => {

const handleSubmitClick = (e) => { //handle submit event.

    }
    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);
        

return (


    <Navbar collapseOnSelect expand="lg" bg="dark" variant="dark">
    <Container fluid>
    
    <Navbar.Brand className='logo' ><h1 className='txt'>Bookshop</h1></Navbar.Brand>
    
    <Navbar.Toggle aria-controls="responsive-navbar-nav" />
    <Navbar.Collapse id="responsive-navbar-nav">
      <Nav className="me-auto">
       <Nav.Link href="/">Home</Nav.Link>
        
        
      </Nav>

      <div className='dropdown'>

      <Dropdown>
        <Dropdown.Toggle  variant="success" id="dropdown-basic">

        <img
        src="https://cdn-icons-png.flaticon.com/512/61/61135.png"
        width="30"
        height="30"
        className="d-inline-block align-top"
        alt="React Bootstrap logo"
        
      />
        </Dropdown.Toggle>

        <Dropdown.Menu>
        <Dropdown.Item href="#/action-1">Update Profile</Dropdown.Item>
        <Dropdown.Item href="#/action-2">Favourites</Dropdown.Item>
        <Dropdown.Item href="#/action-3">Log out</Dropdown.Item>
        </Dropdown.Menu>
        </Dropdown>
      </div>

      <Nav>
        
        <Form className="d-flex">
        <Form.Control
          type="search"
          placeholder="Search for Books"
          className="me-2"
          aria-label="Search"
          size='sm'
        />
        <Button variant="outline-success">Search</Button>
      </Form>
        <Nav.Link eventKey={2} href="#memes" onClick={handleShow}>
          Contact us
        </Nav.Link>

       
        
        <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Contact information</Modal.Title>
        </Modal.Header>
        <Modal.Body> Email: bookStoreSask@gmail.com<br></br>
                     phone: +1 3061234567<br></br>
                     Fax: +1 3061234568
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          
        </Modal.Footer>
      </Modal>
      
      </Nav>
    </Navbar.Collapse>
    </Container>
  </Navbar>

);


}