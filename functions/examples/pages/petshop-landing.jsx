import React from 'npm:react@18.3.1';

const PetshopLanding = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-gradient">🐾 PawPerfect</div>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#home" className="text-gray-700 hover:text-blue-600 transition duration-300">Home</a>
              <a href="#services" className="text-gray-700 hover:text-blue-600 transition duration-300">Services</a>
              <a href="#about" className="text-gray-700 hover:text-blue-600 transition duration-300">About</a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600 transition duration-300">Contact</a>
            </div>
            <button className="border-gradient text-sm font-medium">
              Book Appointment
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="background-gradient text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Your Pet's <br />
                <span className="text-yellow-300">Happy Place</span>
              </h1>
              <p className="text-xl mb-8 text-gray-100">
                Professional pet care services with love, attention, and expertise. 
                We treat your furry friends like family.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="bg-white text-blue-600 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition duration-300">
                  Schedule Visit
                </button>
                <button className="border-2 border-white text-white font-semibold py-3 px-8 rounded-lg hover:bg-white hover:text-blue-600 transition duration-300">
                  Learn More
                </button>
              </div>
            </div>
            <div className="text-center">
              <div className="text-9xl mb-4">🐕</div>
              <p className="text-lg text-gray-200">Over 1000+ happy pets served</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Services</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comprehensive pet care services to keep your furry friends healthy and happy
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Service Cards */}
            <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition duration-300">
              <div className="text-5xl mb-4 text-center">🏥</div>
              <h3 className="text-xl font-semibold mb-3 text-center">Veterinary Care</h3>
              <p className="text-gray-600 text-center">
                Complete medical care including checkups, vaccinations, and emergency treatment
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition duration-300">
              <div className="text-5xl mb-4 text-center">✂️</div>
              <h3 className="text-xl font-semibold mb-3 text-center">Pet Grooming</h3>
              <p className="text-gray-600 text-center">
                Professional grooming services to keep your pet looking and feeling their best
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition duration-300">
              <div className="text-5xl mb-4 text-center">🏨</div>
              <h3 className="text-xl font-semibold mb-3 text-center">Pet Boarding</h3>
              <p className="text-gray-600 text-center">
                Safe and comfortable boarding facilities when you're away from home
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition duration-300">
              <div className="text-5xl mb-4 text-center">🎓</div>
              <h3 className="text-xl font-semibold mb-3 text-center">Pet Training</h3>
              <p className="text-gray-600 text-center">
                Professional training programs for puppies and adult dogs
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition duration-300">
              <div className="text-5xl mb-4 text-center">🛒</div>
              <h3 className="text-xl font-semibold mb-3 text-center">Pet Supplies</h3>
              <p className="text-gray-600 text-center">
                Quality food, toys, and accessories for all your pet's needs
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition duration-300">
              <div className="text-5xl mb-4 text-center">🚐</div>
              <h3 className="text-xl font-semibold mb-3 text-center">Mobile Services</h3>
              <p className="text-gray-600 text-center">
                Convenient at-home services for busy pet parents
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Why Choose PawPerfect?</h2>
              <p className="text-lg text-gray-600 mb-6">
                With over 15 years of experience in pet care, we've built our reputation on 
                trust, compassion, and exceptional service. Our team of certified veterinarians 
                and pet care specialists are passionate about providing the best care for your beloved pets.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="text-2xl mr-4">✅</div>
                  <span className="text-gray-700">Licensed and certified professionals</span>
                </div>
                <div className="flex items-center">
                  <div className="text-2xl mr-4">✅</div>
                  <span className="text-gray-700">24/7 emergency care available</span>
                </div>
                <div className="flex items-center">
                  <div className="text-2xl mr-4">✅</div>
                  <span className="text-gray-700">State-of-the-art facilities</span>
                </div>
                <div className="flex items-center">
                  <div className="text-2xl mr-4">✅</div>
                  <span className="text-gray-700">Affordable pricing and payment plans</span>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-8">
                <div className="text-6xl mb-4">👩‍⚕️</div>
                <h3 className="text-xl font-semibold mb-2">Dr. Sarah Johnson</h3>
                <p className="text-gray-600 mb-4">Lead Veterinarian</p>
                <p className="text-gray-600 italic">
                  "Every pet deserves the best care possible. That's what we strive to deliver every day."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="background-gradient text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">1000+</div>
              <div className="text-gray-200">Happy Pets</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">15</div>
              <div className="text-gray-200">Years Experience</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">24/7</div>
              <div className="text-gray-200">Emergency Care</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">98%</div>
              <div className="text-gray-200">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Get In Touch</h2>
            <p className="text-xl text-gray-600">
              Ready to give your pet the best care? Contact us today!
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-4xl mb-4">📍</div>
              <h3 className="text-xl font-semibold mb-2">Visit Us</h3>
              <p className="text-gray-600">
                123 Pet Street<br />
                Happy Valley, CA 90210
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-4xl mb-4">📞</div>
              <h3 className="text-xl font-semibold mb-2">Call Us</h3>
              <p className="text-gray-600">
                (555) 123-PETS<br />
                Mon-Fri: 8AM-6PM<br />
                Sat-Sun: 9AM-4PM
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-4xl mb-4">✉️</div>
              <h3 className="text-xl font-semibold mb-2">Email Us</h3>
              <p className="text-gray-600">
                info@pawperfect.com<br />
                emergency@pawperfect.com
              </p>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <button className="background-gradient text-white font-semibold py-4 px-8 rounded-lg hover:opacity-90 transition duration-300 text-lg">
              Schedule an Appointment Today
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold text-gradient-content mb-4">🐾 PawPerfect</div>
              <p className="text-gray-400">
                Your trusted partner in pet care. We love your pets as much as you do.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition duration-300">Veterinary Care</a></li>
                <li><a href="#" className="hover:text-white transition duration-300">Pet Grooming</a></li>
                <li><a href="#" className="hover:text-white transition duration-300">Pet Boarding</a></li>
                <li><a href="#" className="hover:text-white transition duration-300">Pet Training</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition duration-300">About Us</a></li>
                <li><a href="#" className="hover:text-white transition duration-300">Contact</a></li>
                <li><a href="#" className="hover:text-white transition duration-300">Emergency Care</a></li>
                <li><a href="#" className="hover:text-white transition duration-300">Careers</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Follow Us</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition duration-300">📱</a>
                <a href="#" className="text-gray-400 hover:text-white transition duration-300">📘</a>
                <a href="#" className="text-gray-400 hover:text-white transition duration-300">📷</a>
                <a href="#" className="text-gray-400 hover:text-white transition duration-300">🐦</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 PawPerfect Petshop. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PetshopLanding; 